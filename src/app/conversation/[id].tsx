import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    FlatList,
    Alert,
    Linking,
    Modal,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ImageViewer } from '../../components/ImageViewer';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Socket } from 'socket.io-client';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Image } from 'expo-image';
import {
    useAudioRecorder,
    useAudioPlayer,
    useAudioPlayerStatus,
    useAudioRecorderState,
    RecordingPresets,
    AudioModule,
} from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
} from 'react-native-reanimated';
import { useChatPrefs, TEXT_SCALE_FACTOR } from '../../stores/chatPrefs';
import {
    ArrowLeft,
    SendHorizonal,
    Check,
    CheckCheck,
    Clock3,
    Plus,
    ImageIcon,
    Camera,
    MapPin,
    X,
    Mic,
    Trash2,
    Play,
    Pause,
    Reply,
    Copy,
    PencilLine,
    Ban,
    Video as VideoIcon,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { optimizedImage } from '../../lib/image';
import { suppressLock } from '../../lib/lockGuard';
import { LiveMap } from '../../components/LiveMap';
import { VideoRecorder } from '../../components/VideoRecorder';
import { queryKeys } from '../../lib/queryClient';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../../stores/auth';
import { Avatar, Skeleton } from '../../components/ui';
import { LockedConversation } from '../../components/LockedConversation';
import { useUnlockConversation } from '../../features/artisans/hooks';
import type { Message, PaywallGate } from '../../types/api';
import { colors, palette, spacing, typography, fontSizes, lineHeights, radii, shadows } from '../../theme/tokens';

/** GET /messages/conversations/:id → historique paginé par curseur (ou verrou paywall) */
interface MessagesPage {
    data: Message[];
    nextCursor: string | null;
    hasMore: boolean;
    /** Paywall : true si l'artisan n'a pas encore débloqué la conversation */
    verrouille?: boolean;
    gate?: PaywallGate;
    apercu?: { nbMessages?: number; dernierMessageAt?: string | null };
}

/** Message local en attente de confirmation serveur (affichage optimiste) */
type ChatMessage = Message & { pending?: boolean };

export default function ConversationScreen() {
    const { id, nom: nomParam } = useLocalSearchParams<{
        id: string;
        nom?: string;
    }>();
    const router = useRouter();
    const queryClient = useQueryClient();
    const userId = useAuth((s) => s.user?.id);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [socketReady, setSocketReady] = useState(false);
    const [draft, setDraft] = useState('');
    const [typingMode, setTypingMode] = useState<null | 'text' | 'audio'>(null);
    const [attachOpen, setAttachOpen] = useState(false);
    const [recording, setRecording] = useState(false);
    const [recordSeconds, setRecordSeconds] = useState(0);
    // isMeteringEnabled : niveau du micro exposé → oscillations façon WhatsApp
    const recorder = useAudioRecorder({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
    });
    const recorderState = useAudioRecorderState(recorder, 100);
    const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    // Fenêtre glissante des niveaux du micro : cadencée par une HORLOGE
    // (15 mesures/s), jamais par les changements de valeur — sinon l'onde
    // fige dès que le volume est stable.
    const [waveLevels, setWaveLevels] = useState<number[]>([]);
    /** TOUS les niveaux de l'enregistrement (pour la forme d'onde envoyée) */
    const fullWaveRef = useRef<number[]>([]);
    const meteringRef = useRef<number | null>(null);
    meteringRef.current = recorderState.metering ?? null; // rafraîchi à chaque rendu
    const lastLevelRef = useRef(0.12);
    useEffect(() => {
        if (!recording) return;
        const tick = setInterval(() => {
            const raw = meteringRef.current;
            // Selon la plateforme, metering est en dB NÉGATIFS (-160..0)
            // ou en AMPLITUDE POSITIVE (0..32767) : on gère les deux échelles
            let level: number;
            if (raw == null) {
                level = 0.12;
            } else if (raw <= 0) {
                level = (raw + 60) / 55; // dB : parole ≈ -35..-10
            } else {
                level = raw / 18000; // amplitude Android : parole ≈ 3000..15000
            }
            level = Math.min(1, Math.max(0.08, level));
            // Lissage : montée rapide, retombée douce (rendu naturel)
            const smoothed =
                level >= lastLevelRef.current
                    ? level
                    : lastLevelRef.current * 0.55 + level * 0.45;
            lastLevelRef.current = smoothed;
            fullWaveRef.current.push(smoothed);
            setWaveLevels((prev) => [...prev.slice(-41), smoothed]);
        }, 66);
        return () => clearInterval(tick);
    }, [recording]);

    // Mode audio : lecture qui CONTINUE en arrière-plan (comme WhatsApp) et
    // en mode silencieux iOS. Ré-appliqué après chaque enregistrement, car
    // le mode "enregistrement" bascule la sortie vers l'écouteur.
    const resetPlaybackMode = useCallback(() => {
        void AudioModule.setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: true,
            allowsRecording: false,
        }).catch(() => undefined);
    }, []);
    useEffect(() => {
        resetPlaybackMode();
    }, [resetPlaybackMode]);

    // Caméra vidéo intégrée (720p — vidéos légères)
    const [showRecorder, setShowRecorder] = useState(false);

    // Actions sur les messages (appui long / glisser)
    const [actionTarget, setActionTarget] = useState<ChatMessage | null>(null);
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
    const [editing, setEditing] = useState<ChatMessage | null>(null);
    const [viewerUri, setViewerUri] = useState<string | null>(null);
    // Médias révélés manuellement quand le téléchargement auto est désactivé
    const [revealed, setRevealed] = useState<Set<string>>(new Set());
    const autoDownloadMedia = useChatPrefs((s) => s.autoDownloadMedia);
    const textScale = useChatPrefs((s) => s.textScale);
    const socketRef = useRef<Socket | null>(null);
    // Messages entrants pour lesquels on a déjà émis « mark_read » (évite les doublons)
    const markedReadRef = useRef<Set<string>>(new Set());
    const listRef = useRef<FlatList<ChatMessage>>(null);
    const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Historique via REST (persisté offline par TanStack Query)
    const { data: history, isLoading } = useQuery({
        queryKey: queryKeys.messages(id),
        queryFn: async () => {
            const { data } = await api.get<MessagesPage>(`/messages/conversations/${id}`, {
                params: { limit: 50 },
            });
            return data;
        },
    });

    useEffect(() => {
        if (history?.data) {
            // Fusionner sans écraser les messages optimistes en attente
            setMessages((prev) => {
                const pending = prev.filter((m) => m.pending);
                const ids = new Set(history.data.map((m) => m.id));
                return [...history.data, ...pending.filter((m) => !ids.has(m.id))];
            });
        }
    }, [history]);

    // ─── Paywall : déblocage de la conversation (côté artisan) ─────────────────
    const locked = history?.verrouille === true;
    const unlock = useUnlockConversation(id);
    const handleUnlock = useCallback(() => {
        unlock.mutate(undefined, {
            onError: (e) => {
                // 402 → l'artisan doit s'abonner : on l'emmène sur l'abonnement
                if (e instanceof ApiError && e.status === 402) {
                    router.push('/abonnement');
                    return;
                }
                Alert.alert(
                    'Déblocage impossible',
                    e instanceof ApiError ? e.message : 'Réessayez dans un instant.',
                );
            },
        });
    }, [unlock, router]);

    // Temps réel : réception uniquement (l'envoi passe par REST, plus fiable)
    useEffect(() => {
        let active = true;

        void (async () => {
            const socket = await getSocket('/chat');
            if (!active) return;
            socketRef.current = socket;

            const join = () => {
                socket.emit('join_conversation', { conversationId: id });
                setSocketReady(true);
            };
            socket.on('connect', join);
            if (socket.connected) join();

            socket.on('message:new', (message: Message) => {
                if (message.conversationId !== id) return;
                setMessages((prev) =>
                    prev.some((m) => m.id === message.id)
                        ? prev.map((m) => (m.id === message.id ? { ...message } : m))
                        : [...prev, message],
                );
                // Le marquage « lu » (et l'accusé ✓✓ vers l'expéditeur) est géré
                // par l'effet dédié ci-dessous, qui couvre AUSSI l'historique.
            });
            socket.on('message:read', (p: { messageId: string }) => {
                setMessages((prev) =>
                    prev.map((m) => (m.id === p.messageId ? { ...m, lu: true } : m)),
                );
            });
            socket.on('message:delivered', (p: { messageId: string }) => {
                setMessages((prev) =>
                    prev.map((m) => (m.id === p.messageId ? { ...m, remis: true } : m)),
                );
            });
            // Modification / suppression : les deux parties voient en direct
            socket.on('message:updated', (updated: Message) => {
                if (updated.conversationId !== id) return;
                setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
            });
            socket.on('message:deleted', (deleted: Message) => {
                if (deleted.conversationId !== id) return;
                setMessages((prev) => prev.map((m) => (m.id === deleted.id ? deleted : m)));
            });
            socket.on(
                'typing:start',
                (p: { conversationId: string; mode?: 'text' | 'audio' }) => {
                    if (p.conversationId === id) setTypingMode(p.mode ?? 'text');
                },
            );
            socket.on('typing:stop', (p: { conversationId: string }) => {
                if (p.conversationId === id) setTypingMode(null);
            });
        })();

        return () => {
            active = false;
            setSocketReady(false);
            socketRef.current?.off('message:new');
            socketRef.current?.off('message:read');
            socketRef.current?.off('message:delivered');
            socketRef.current?.off('message:updated');
            socketRef.current?.off('message:deleted');
            socketRef.current?.off('typing:start');
            socketRef.current?.off('typing:stop');
            void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
        };
    }, [id, userId, queryClient]);

    // Accusés de lecture : émettre « mark_read » pour tout message ENTRANT non
    // lu — y compris ceux déjà présents à l'ouverture (historique). La gateway
    // renvoie alors « message:read » à l'expéditeur → ses ✓ passent en ✓✓ EN
    // DIRECT. Le Set évite de ré-émettre pour un même message.
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;
        for (const m of messages) {
            if (m.pending || m.lu || m.senderId === userId) continue;
            if (markedReadRef.current.has(m.id)) continue;
            markedReadRef.current.add(m.id);
            socket.emit('mark_read', { messageId: m.id });
        }
    }, [messages, userId, socketReady]);

    /**
     * Envoi via REST avec affichage OPTIMISTE : la bulle apparaît
     * immédiatement (horloge), puis passe en ✓ à la confirmation serveur.
     * Gère aussi la MODIFICATION (mode édition) et la RÉPONSE (citation).
     */
    const send = useCallback(async () => {
        const contenu = draft.trim();
        if (!contenu || !userId) return;

        // Mode ÉDITION : PATCH au lieu d'un nouvel envoi
        if (editing) {
            const target = editing;
            setEditing(null);
            setDraft('');
            try {
                const { data: updated } = await api.patch<Message>(`/messages/${target.id}`, {
                    contenu,
                });
                setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
            } catch (e) {
                setDraft(contenu);
                setEditing(target);
                Alert.alert(
                    'Modification impossible',
                    e instanceof ApiError ? e.message : 'Réessayez.',
                );
            }
            return;
        }

        const quoted = replyTo;
        setDraft('');
        setReplyTo(null);
        socketRef.current?.emit('typing_stop', { conversationId: id });

        const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const optimistic: ChatMessage = {
            id: tempId,
            conversationId: id,
            senderId: userId,
            type: 'text',
            contenu,
            lu: false,
            createdAt: new Date().toISOString(),
            pending: true,
            replyToId: quoted?.id ?? null,
            replyTo: quoted
                ? {
                      id: quoted.id,
                      type: quoted.type,
                      contenu: quoted.contenu,
                      mediaUrl: quoted.mediaUrl,
                      senderId: quoted.senderId,
                  }
                : null,
        };
        setMessages((prev) => [...prev, optimistic]);

        try {
            const { data: saved } = await api.post<Message>(`/messages/conversations/${id}`, {
                type: 'text',
                contenu,
                replyToId: quoted?.id,
            });
            // Remplacer la bulle temporaire par le message confirmé
            setMessages((prev) => {
                const withoutTemp = prev.filter((m) => m.id !== tempId);
                return withoutTemp.some((m) => m.id === saved.id)
                    ? withoutTemp
                    : [...withoutTemp, saved];
            });
        } catch (e) {
            // Échec : retirer la bulle et restaurer le brouillon
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            setDraft(contenu);
            setReplyTo(quoted);
            // Anti-fuite : message bloqué (coordonnées interdites) ou autre erreur
            if (e instanceof ApiError) {
                Alert.alert(
                    e.code === 'CONTACT_INTERDIT' ? 'Message bloqué 🔒' : 'Envoi impossible',
                    e.message,
                );
            }
        }
    }, [draft, id, userId, editing, replyTo]);

    // ─── Actions sur un message (appui long) ────────────────────────────────

    const EDIT_WINDOW_MS = 15 * 60 * 1000;
    const DELETE_WINDOW_MS = 60 * 60 * 1000;

    const openActions = (m: ChatMessage) => {
        if (m.supprime || m.pending) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setActionTarget(m);
    };

    const actReply = () => {
        if (!actionTarget) return;
        setReplyTo(actionTarget);
        setEditing(null);
        setActionTarget(null);
    };

    const actCopy = async () => {
        if (actionTarget?.contenu) await Clipboard.setStringAsync(actionTarget.contenu);
        setActionTarget(null);
    };

    const actEdit = () => {
        if (!actionTarget) return;
        setDraft(actionTarget.contenu ?? '');
        setEditing(actionTarget);
        setReplyTo(null);
        setActionTarget(null);
    };

    const actDelete = () => {
        const target = actionTarget;
        setActionTarget(null);
        if (!target) return;
        Alert.alert('Supprimer le message', 'Il sera supprimé pour tout le monde.', [
            { text: 'Annuler', style: 'cancel' },
            {
                text: 'Supprimer',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const { data: deleted } = await api.delete<Message>(
                            `/messages/${target.id}`,
                        );
                        setMessages((prev) =>
                            prev.map((m) => (m.id === deleted.id ? deleted : m)),
                        );
                    } catch (e) {
                        Alert.alert(
                            'Suppression impossible',
                            e instanceof ApiError ? e.message : 'Réessayez.',
                        );
                    }
                },
            },
        ]);
    };

    /** Envoi générique d'un message non-texte (image / position) avec bulle optimiste */
    const sendRich = useCallback(
        async (
            body: { type: 'image' | 'location'; mediaUrl?: string; latitude?: number; longitude?: number; contenu?: string },
            optimisticExtras: Partial<ChatMessage>,
        ) => {
            if (!userId) return;
            const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            setMessages((prev) => [
                ...prev,
                {
                    id: tempId,
                    conversationId: id,
                    senderId: userId,
                    lu: false,
                    createdAt: new Date().toISOString(),
                    pending: true,
                    type: body.type,
                    contenu: body.contenu ?? null,
                    ...optimisticExtras,
                } as ChatMessage,
            ]);
            try {
                const { data: saved } = await api.post<Message>(
                    `/messages/conversations/${id}`,
                    body,
                );
                setMessages((prev) => {
                    const withoutTemp = prev.filter((m) => m.id !== tempId);
                    return withoutTemp.some((m) => m.id === saved.id)
                        ? withoutTemp
                        : [...withoutTemp, saved];
                });
            } catch {
                setMessages((prev) => prev.filter((m) => m.id !== tempId));
                Alert.alert('Envoi impossible', 'Vérifiez votre connexion puis réessayez.');
            }
        },
        [id, userId],
    );

    /**
     * Upload + envoi d'un média (photo ou vidéo) avec bulle optimiste.
     * Les fichiers partent sur le CDN : le serveur ne stocke rien, et le
     * téléphone garde le média en cache après la première lecture.
     */
    const uploadAndSendMedia = useCallback(
        async (asset: ImagePicker.ImagePickerAsset, kind: 'image' | 'video') => {
            if (!userId) return;

            // Garde-fous vidéo : 60 s / 25 Mo max (données mobiles + quota CDN)
            if (kind === 'video') {
                const durationSec = (asset.duration ?? 0) / 1000;
                if (durationSec > 65) {
                    Alert.alert('Vidéo trop longue', 'Maximum 60 secondes par vidéo.');
                    return;
                }
                if ((asset.fileSize ?? 0) > 50 * 1024 * 1024) {
                    Alert.alert(
                        'Vidéo trop lourde',
                        'Maximum 50 Mo par vidéo (environ 1 à 2 minutes). Filmez plus court.',
                    );
                    return;
                }
            }

            const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            setMessages((prev) => [
                ...prev,
                {
                    id: tempId,
                    conversationId: id,
                    senderId: userId,
                    type: kind,
                    contenu: null,
                    mediaUrl: asset.uri, // aperçu/lecture LOCALE le temps de l'upload
                    mediaDuree: asset.duration ? Math.round(asset.duration / 1000) : undefined,
                    lu: false,
                    createdAt: new Date().toISOString(),
                    pending: true,
                } as ChatMessage,
            ]);

            try {
                const form = new FormData();
                form.append('file', {
                    uri: asset.uri,
                    name: asset.fileName ?? (kind === 'video' ? 'video.mp4' : 'photo.jpg'),
                    type: asset.mimeType ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
                } as unknown as Blob);
                const endpoint = kind === 'video' ? '/upload/video' : '/upload/image?folder=chat';
                const { data: uploaded } = await api.post<{ url: string }>(endpoint, form, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    timeout: 120000,
                });
                const { data: saved } = await api.post<Message>(
                    `/messages/conversations/${id}`,
                    {
                        type: kind,
                        mediaUrl: uploaded.url,
                        mediaDuree: asset.duration
                            ? Math.round(asset.duration / 1000)
                            : undefined,
                    },
                );
                setMessages((prev) => {
                    const withoutTemp = prev.filter((m) => m.id !== tempId);
                    return withoutTemp.some((m) => m.id === saved.id)
                        ? withoutTemp
                        : [...withoutTemp, saved];
                });
            } catch (e) {
                setMessages((prev) => prev.filter((m) => m.id !== tempId));
                Alert.alert(
                    kind === 'video' ? 'Vidéo non envoyée' : 'Photo non envoyée',
                    e instanceof ApiError
                        ? e.message
                        : 'Vérifiez votre connexion puis réessayez.',
                );
            }
        },
        [id, userId],
    );

    /** Galerie : photos ET vidéos */
    const sendFromGallery = useCallback(async () => {
        setAttachOpen(false);
        suppressLock(); // la galerie met l'app en arrière-plan : pas d'empreinte au retour
        const picked = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            quality: 0.7,
            videoMaxDuration: 60,
            videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
        });
        if (picked.canceled || !picked.assets?.[0]) return;
        const asset = picked.assets[0];
        await uploadAndSendMedia(asset, asset.type === 'video' ? 'video' : 'image');
    }, [uploadAndSendMedia]);

    /** Caméra : prendre une photo */
    const sendImage = useCallback(
        async (_fromCamera: boolean) => {
            setAttachOpen(false);
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) return;
            suppressLock();
            const picked = await ImagePicker.launchCameraAsync({ quality: 0.7 });
            if (picked.canceled || !picked.assets?.[0]) return;
            await uploadAndSendMedia(picked.assets[0], 'image');
        },
        [uploadAndSendMedia],
    );

    /**
     * Filmer une courte vidéo — caméra INTÉGRÉE en 720p : la caméra système
     * filmait en pleine résolution (4K ≈ 6 Mo/s → 12 s dépassaient 50 Mo).
     * Ici, 12 s ≈ 3-6 Mo : l'envoi passe partout.
     */
    const recordVideo = useCallback(() => {
        setAttachOpen(false);
        setShowRecorder(true);
    }, []);

    /** Partager sa position actuelle */
    const sendLocation = useCallback(async () => {
        setAttachOpen(false);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Position refusée', 'Autorisez la localisation pour la partager.');
            return;
        }
        const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });
        await sendRich(
            {
                type: 'location',
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                contenu: 'Position partagée',
            },
            { latitude: pos.coords.latitude, longitude: pos.coords.longitude } as Partial<ChatMessage>,
        );
    }, [sendRich]);

    // ─── Messages vocaux ─────────────────────────────────────────────────────

    const startRecording = async () => {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) {
            Alert.alert('Micro refusé', 'Autorisez le micro pour envoyer des vocaux.');
            return;
        }
        setAttachOpen(false);
        await recorder.prepareToRecordAsync();
        recorder.record();
        setRecording(true);
        setRecordSeconds(0);
        setWaveLevels([]); // repartir avec des oscillations vierges
        fullWaveRef.current = [];
        lastLevelRef.current = 0.12;
        recordTimer.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
        // L'autre voit « 🎤 enregistre un vocal… »
        socketRef.current?.emit('typing_start', { conversationId: id, mode: 'audio' });
    };

    const stopRecordTimer = () => {
        if (recordTimer.current) {
            clearInterval(recordTimer.current);
            recordTimer.current = null;
        }
    };

    const cancelRecording = async () => {
        stopRecordTimer();
        setRecording(false);
        socketRef.current?.emit('typing_stop', { conversationId: id });
        try {
            await recorder.stop();
        } catch {
            // déjà arrêté
        }
        resetPlaybackMode(); // sortie haut-parleur + arrière-plan rétablis
    };

    const sendVoiceMessage = async () => {
        stopRecordTimer();
        setRecording(false);
        socketRef.current?.emit('typing_stop', { conversationId: id });
        const duree = recordSeconds;
        try {
            await recorder.stop();
        } catch {
            return;
        } finally {
            resetPlaybackMode(); // sortie haut-parleur + arrière-plan rétablis
        }
        const uri = recorder.uri;
        if (!uri || duree < 1 || !userId) return;

        const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setMessages((prev) => [
            ...prev,
            {
                id: tempId,
                conversationId: id,
                senderId: userId,
                type: 'audio',
                contenu: null,
                mediaUrl: uri, // lecture locale possible pendant l'upload
                mediaDuree: duree,
                waveform: downsampleWave(fullWaveRef.current, 48),
                lu: false,
                createdAt: new Date().toISOString(),
                pending: true,
            } as ChatMessage,
        ]);
        try {
            const form = new FormData();
            form.append('file', {
                uri,
                name: 'vocal.m4a',
                type: 'audio/m4a',
            } as unknown as Blob);
            const { data: uploaded } = await api.post<{ url: string }>('/upload/audio', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 60000,
            });
            const { data: saved } = await api.post<Message>(`/messages/conversations/${id}`, {
                type: 'audio',
                mediaUrl: uploaded.url,
                mediaDuree: duree,
                // Forme d'onde réelle, réduite à 48 barres max
                waveform: downsampleWave(fullWaveRef.current, 48),
            });
            setMessages((prev) => {
                const withoutTemp = prev.filter((m) => m.id !== tempId);
                return withoutTemp.some((m) => m.id === saved.id)
                    ? withoutTemp
                    : [...withoutTemp, saved];
            });
        } catch (e) {
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            // Afficher la vraie cause (serveur) pour ne jamais deviner
            Alert.alert(
                'Vocal non envoyé',
                e instanceof ApiError ? e.message : 'Vérifiez votre connexion puis réessayez.',
            );
        }
    };

    const onType = (value: string) => {
        setDraft(value);
        const socket = socketRef.current;
        if (!socket) return;
        socket.emit('typing_start', { conversationId: id });
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(
            () => socket.emit('typing_stop', { conversationId: id }),
            1500,
        );
    };

    const nom = nomParam || 'Conversation';

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* En-tête */}
            <View style={styles.header}>
                <Pressable
                    onPress={() => router.back()}
                    hitSlop={12}
                    style={styles.backButton}
                    accessibilityRole="button"
                    accessibilityLabel="Retour"
                >
                    <ArrowLeft size={22} color={colors.text} strokeWidth={2} />
                </Pressable>
                <Avatar name={nom} size={36} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerName} numberOfLines={1}>
                        {nom}
                    </Text>
                    <Text
                        style={[styles.headerStatus, typingMode && { color: palette.green600 }]}
                    >
                        {typingMode === 'audio'
                            ? '🎤 enregistre un vocal…'
                            : typingMode
                              ? 'écrit…'
                              : 'sur AlloArtisan'}
                    </Text>
                </View>
                {/* Pas de bouton d'appel : les échanges restent sur la plateforme
                    (anti-désintermédiation). Le numéro n'est jamais exposé. */}
            </View>

            {/* Paywall : conversation verrouillée tant que l'artisan n'a pas débloqué */}
            {locked && history?.gate ? (
                <LockedConversation
                    gate={history.gate}
                    apercu={history.apercu}
                    clientNom={nom}
                    unlocking={unlock.isPending}
                    onUnlock={handleUnlock}
                    onVoirAbonnements={() => router.push('/abonnement')}
                />
            ) : (
            /* 'padding' sur les DEUX plateformes : avec l'edge-to-edge du SDK 57,
                Android ne redimensionne plus la fenêtre tout seul */
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior="padding"
                keyboardVerticalOffset={0}
            >
                {isLoading && messages.length === 0 ? (
                    <View style={[styles.chatArea, { padding: spacing.xl, gap: spacing.md }]}>
                        <Skeleton width="60%" height={40} borderRadius={radii.lg} />
                        <Skeleton
                            width="55%"
                            height={40}
                            borderRadius={radii.lg}
                            style={{ alignSelf: 'flex-end' }}
                        />
                        <Skeleton width="70%" height={40} borderRadius={radii.lg} />
                    </View>
                ) : (
                    <FlatList
                        ref={listRef}
                        data={messages}
                        keyExtractor={(item) => item.id}
                        style={styles.chatArea}
                        contentContainerStyle={styles.messages}
                        onContentSizeChange={() =>
                            listRef.current?.scrollToEnd({ animated: false })
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyHint}>
                                <Text style={styles.emptyHintText}>
                                    Dites bonjour 👋 et décrivez votre besoin. Les réponses
                                    arrivent en direct.
                                </Text>
                            </View>
                        }
                        renderItem={({ item, index }) => (
                            <MessageBubble
                                message={item}
                                mine={item.senderId === userId}
                                previous={messages[index - 1]}
                                fontScale={TEXT_SCALE_FACTOR[textScale]}
                                mediaVisible={
                                    autoDownloadMedia ||
                                    item.senderId === userId ||
                                    revealed.has(item.id)
                                }
                                onReveal={() =>
                                    setRevealed((prev) => new Set(prev).add(item.id))
                                }
                                onLongPress={() => openActions(item)}
                                onImagePress={(uri) => setViewerUri(uri)}
                                onSwipeReply={() => {
                                    if (item.supprime || item.pending) return;
                                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setReplyTo(item);
                                    setEditing(null);
                                }}
                            />
                        )}
                    />
                )}

                {/* Barre de réponse / modification au-dessus du champ */}
                {(replyTo || editing) && (
                    <View style={styles.contextBar}>
                        {editing ? (
                            <PencilLine size={16} color={colors.primary} strokeWidth={2.2} />
                        ) : (
                            <Reply size={16} color={colors.primary} strokeWidth={2.2} />
                        )}
                        <View style={{ flex: 1 }}>
                            <Text style={styles.contextTitle}>
                                {editing
                                    ? 'Modifier le message'
                                    : replyTo?.senderId === userId
                                      ? 'Répondre à vous-même'
                                      : `Répondre à ${nomParam ?? ''}`.trim()}
                            </Text>
                            <Text style={styles.contextPreview} numberOfLines={1}>
                                {editing
                                    ? (editing.contenu ?? '')
                                    : replyTo?.type === 'image'
                                      ? '📷 Photo'
                                      : replyTo?.type === 'audio'
                                        ? '🎤 Message vocal'
                                        : replyTo?.type === 'location'
                                          ? '📍 Position'
                                          : (replyTo?.contenu ?? '')}
                            </Text>
                        </View>
                        <Pressable
                            onPress={() => {
                                setReplyTo(null);
                                if (editing) setDraft('');
                                setEditing(null);
                            }}
                            hitSlop={10}
                            accessibilityRole="button"
                            accessibilityLabel="Annuler"
                        >
                            <X size={18} color={colors.textSecondary} strokeWidth={2.2} />
                        </Pressable>
                    </View>
                )}

                {/* Feuille de pièces jointes */}
                {attachOpen && (
                    <View style={styles.attachSheet}>
                        <AttachOption
                            icon={<ImageIcon size={22} color="#7C3AED" strokeWidth={2} />}
                            bg="#EDE9FE"
                            label="Galerie"
                            onPress={() => void sendFromGallery()}
                        />
                        <AttachOption
                            icon={<Camera size={22} color="#BE185D" strokeWidth={2} />}
                            bg="#FCE7F3"
                            label="Photo"
                            onPress={() => void sendImage(true)}
                        />
                        <AttachOption
                            icon={<VideoIcon size={22} color="#B45309" strokeWidth={2} />}
                            bg="#FEF3C7"
                            label="Filmer"
                            onPress={() => void recordVideo()}
                        />
                        <AttachOption
                            icon={<MapPin size={22} color="#15803D" strokeWidth={2} />}
                            bg="#DCFCE7"
                            label="Position"
                            onPress={() => void sendLocation()}
                        />
                    </View>
                )}

                {/* Zone de saisie / enregistrement vocal */}
                {recording ? (
                    <View style={styles.composer}>
                        <Pressable
                            onPress={() => void cancelRecording()}
                            style={styles.attachButton}
                            accessibilityRole="button"
                            accessibilityLabel="Annuler l'enregistrement"
                        >
                            <Trash2 size={21} color={palette.red600} strokeWidth={2} />
                        </Pressable>
                        <View style={styles.recordingInfo}>
                            <View style={styles.recordingDot} />
                            <Text style={styles.recordingText}>
                                {Math.floor(recordSeconds / 60)}:
                                {String(recordSeconds % 60).padStart(2, '0')}
                            </Text>
                            {/* Oscillations du micro, façon WhatsApp */}
                            <View style={styles.waveRow} accessibilityElementsHidden>
                                {waveLevels.map((level, i) => (
                                    <View
                                        key={i}
                                        style={[
                                            styles.waveBar,
                                            { height: 4 + level * 22 },
                                        ]}
                                    />
                                ))}
                            </View>
                        </View>
                        <Pressable
                            onPress={() => void sendVoiceMessage()}
                            style={styles.sendButton}
                            accessibilityRole="button"
                            accessibilityLabel="Envoyer le vocal"
                        >
                            <SendHorizonal size={20} color={colors.onDark} strokeWidth={2} />
                        </Pressable>
                    </View>
                ) : (
                    <View style={styles.composer}>
                        <Pressable
                            onPress={() => setAttachOpen((o) => !o)}
                            style={styles.attachButton}
                            accessibilityRole="button"
                            accessibilityLabel={
                                attachOpen ? 'Fermer les pièces jointes' : 'Joindre'
                            }
                        >
                            {attachOpen ? (
                                <X size={22} color={colors.textSecondary} strokeWidth={2} />
                            ) : (
                                <Plus size={22} color={colors.textSecondary} strokeWidth={2} />
                            )}
                        </Pressable>
                        <TextInput
                            style={styles.composerInput}
                            placeholder="Écrivez votre message…"
                            placeholderTextColor={colors.textMuted}
                            value={draft}
                            onChangeText={onType}
                            onFocus={() => setAttachOpen(false)}
                            multiline
                            maxLength={2000}
                            accessibilityLabel="Message"
                        />
                        {draft.trim() ? (
                            <Pressable
                                onPress={send}
                                style={styles.sendButton}
                                accessibilityRole="button"
                                accessibilityLabel="Envoyer"
                            >
                                <SendHorizonal size={20} color={colors.onDark} strokeWidth={2} />
                            </Pressable>
                        ) : (
                            <Pressable
                                onPress={() => void startRecording()}
                                style={styles.sendButton}
                                accessibilityRole="button"
                                accessibilityLabel="Enregistrer un message vocal"
                            >
                                <Mic size={20} color={colors.onDark} strokeWidth={2} />
                            </Pressable>
                        )}
                    </View>
                )}
            </KeyboardAvoidingView>
            )}

            {/* Visionneuse d'image plein écran (pincer pour zoomer) */}
            <ImageViewer
                uri={viewerUri}
                visible={viewerUri != null}
                onClose={() => setViewerUri(null)}
            />

            {/* Caméra intégrée 720p : filmer une panne sans quitter l'app */}
            <VideoRecorder
                visible={showRecorder}
                onClose={() => setShowRecorder(false)}
                onRecorded={(uri, durationSec) =>
                    void uploadAndSendMedia(
                        {
                            uri,
                            duration: durationSec * 1000,
                            fileName: 'video.mp4',
                            mimeType: 'video/mp4',
                        } as ImagePicker.ImagePickerAsset,
                        'video',
                    )
                }
            />

            {/* Menu d'actions (appui long sur un message) */}
            <Modal
                visible={actionTarget != null}
                transparent
                animationType="fade"
                onRequestClose={() => setActionTarget(null)}
            >
                <Pressable style={styles.sheetBackdrop} onPress={() => setActionTarget(null)}>
                    <View style={styles.sheet}>
                        <ActionRow
                            icon={<Reply size={19} color={colors.text} strokeWidth={2} />}
                            label="Répondre"
                            onPress={actReply}
                        />
                        {actionTarget?.type === 'text' && (
                            <ActionRow
                                icon={<Copy size={19} color={colors.text} strokeWidth={2} />}
                                label="Copier"
                                onPress={() => void actCopy()}
                            />
                        )}
                        {actionTarget != null &&
                            actionTarget.senderId === userId &&
                            actionTarget.type === 'text' &&
                            Date.now() - new Date(actionTarget.createdAt).getTime() <
                                EDIT_WINDOW_MS && (
                                <ActionRow
                                    icon={
                                        <PencilLine
                                            size={19}
                                            color={colors.text}
                                            strokeWidth={2}
                                        />
                                    }
                                    label="Modifier"
                                    onPress={actEdit}
                                />
                            )}
                        {actionTarget != null &&
                            actionTarget.senderId === userId &&
                            Date.now() - new Date(actionTarget.createdAt).getTime() <
                                DELETE_WINDOW_MS && (
                                <ActionRow
                                    icon={
                                        <Trash2
                                            size={19}
                                            color={palette.red600}
                                            strokeWidth={2}
                                        />
                                    }
                                    label="Supprimer pour tous"
                                    destructive
                                    onPress={actDelete}
                                />
                            )}
                    </View>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

function ActionRow({
    icon,
    label,
    destructive,
    onPress,
}: {
    icon: React.ReactNode;
    label: string;
    destructive?: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            style={({ pressed }) => [
                styles.actionRow,
                pressed && { backgroundColor: colors.surfaceMuted },
            ]}
        >
            {icon}
            <Text style={[styles.actionLabel, destructive && { color: palette.red600 }]}>
                {label}
            </Text>
        </Pressable>
    );
}

/** Message vocal : lecture/pause + progression + durée */
/** Réduit une série de niveaux à `target` barres (moyenne par tranche) */
function downsampleWave(levels: number[], target: number): number[] | undefined {
    if (!levels.length) return undefined;
    if (levels.length <= target) return levels.map((v) => Math.round(v * 100) / 100);
    const out: number[] = [];
    const chunk = levels.length / target;
    for (let i = 0; i < target; i++) {
        const slice = levels.slice(Math.floor(i * chunk), Math.ceil((i + 1) * chunk));
        const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
        out.push(Math.round(avg * 100) / 100);
    }
    return out;
}

/** Onde de repli pour les anciens vocaux sans waveform (déterministe) */
function fallbackWave(seed: number): number[] {
    const out: number[] = [];
    let x = seed || 7;
    for (let i = 0; i < 32; i++) {
        x = (x * 9301 + 49297) % 233280;
        out.push(0.25 + (x / 233280) * 0.6);
    }
    return out;
}

function AudioBubble({
    uri,
    duree,
    mine,
    waveform,
}: {
    uri: string;
    duree: number;
    mine: boolean;
    waveform?: number[] | null;
}) {
    const player = useAudioPlayer(uri);
    const status = useAudioPlayerStatus(player);
    const fg = mine ? '#FFFFFF' : colors.primary;
    const fgDim = mine ? 'rgba(255,255,255,0.35)' : 'rgba(30,58,138,0.28)';

    const toggle = () => {
        if (status.playing) {
            player.pause();
        } else {
            // Relire depuis le début si terminé
            if (status.didJustFinish || status.currentTime >= status.duration - 0.2) {
                player.seekTo(0);
            }
            player.play();
        }
    };

    const total = duree || Math.round(status.duration || 0);
    const progress =
        status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;

    // Forme d'onde réelle (envoyée avec le vocal) ; repli déterministe sinon.
    // Sous-échantillonnée à MAX_BARS pour tenir dans la bulle sans déborder.
    const rawBars =
        waveform && waveform.length > 0 ? waveform : fallbackWave(total * 31 + uri.length);
    const MAX_BARS = 28;
    const bars =
        rawBars.length > MAX_BARS
            ? Array.from(
                  { length: MAX_BARS },
                  (_, i) => rawBars[Math.floor((i * rawBars.length) / MAX_BARS)],
              )
            : rawBars;
    const playedBars = Math.round(progress * bars.length);

    return (
        <View style={styles.audioRow}>
            <Pressable
                onPress={toggle}
                style={[styles.audioPlay, { borderColor: fg }]}
                accessibilityRole="button"
                accessibilityLabel={status.playing ? 'Pause' : 'Écouter le vocal'}
            >
                {status.playing ? (
                    <Pause size={15} color={fg} fill={fg} strokeWidth={0} />
                ) : (
                    <Play size={15} color={fg} fill={fg} strokeWidth={0} />
                )}
            </Pressable>
            {/* Forme d'onde : la partie déjà écoutée est en couleur pleine */}
            <View style={styles.audioWave}>
                {bars.map((level, i) => (
                    <View
                        key={i}
                        style={[
                            styles.audioWaveBar,
                            {
                                height: 3 + level * 19,
                                backgroundColor: i < playedBars ? fg : fgDim,
                            },
                        ]}
                    />
                ))}
            </View>
            <Text style={[styles.audioDuration, { color: mine ? 'rgba(255,255,255,0.85)' : colors.textSecondary }]}>
                {Math.floor(total / 60)}:{String(total % 60).padStart(2, '0')}
            </Text>
        </View>
    );
}

function AttachOption({
    icon,
    bg,
    label,
    onPress,
}: {
    icon: React.ReactNode;
    bg: string;
    label: string;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.attachOption, pressed && { transform: [{ scale: 0.95 }] }]}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <View style={[styles.attachIcon, { backgroundColor: bg }]}>{icon}</View>
            <Text style={styles.attachLabel}>{label}</Text>
        </Pressable>
    );
}

/** Bulle façon WhatsApp : heure + état d'envoi (🕐 / ✓ / ✓✓) dans la bulle */
function MessageBubble({
    message,
    mine,
    previous,
    fontScale,
    mediaVisible,
    onReveal,
    onLongPress,
    onImagePress,
    onSwipeReply,
}: {
    message: ChatMessage;
    mine: boolean;
    previous?: ChatMessage;
    fontScale: number;
    mediaVisible: boolean;
    onReveal: () => void;
    onLongPress: () => void;
    onImagePress: (uri: string) => void;
    onSwipeReply: () => void;
}) {
    const showDate =
        !previous ||
        new Date(message.createdAt).toDateString() !==
            new Date(previous.createdAt).toDateString();
    const heure = new Date(message.createdAt).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
    });

    // Glisser vers la droite pour répondre (façon WhatsApp / Telegram)
    const swipeX = useSharedValue(0);
    const triggered = useSharedValue(false);
    const swipeGesture = Gesture.Pan()
        .activeOffsetX(20) // uniquement vers la droite
        .failOffsetY([-14, 14]) // laisse le scroll vertical tranquille
        .onUpdate((e) => {
            swipeX.value = Math.min(72, Math.max(0, e.translationX));
            if (swipeX.value >= 56 && !triggered.value) {
                triggered.value = true;
                runOnJS(onSwipeReply)();
            }
        })
        .onEnd(() => {
            swipeX.value = withSpring(0, { damping: 16 });
            triggered.value = false;
        });

    const swipeStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: swipeX.value }],
    }));
    const replyHintStyle = useAnimatedStyle(() => ({
        opacity: Math.min(1, swipeX.value / 56),
    }));

    // Média purgé par la rétention (30 jours) : bulle informative
    if (
        ['image', 'audio', 'video'].includes(message.type) &&
        !message.mediaUrl &&
        !message.supprime
    ) {
        return (
            <View>
                {showDate && <DateSeparator date={message.createdAt} />}
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <View style={styles.deletedRow}>
                        <Clock3
                            size={13}
                            color={mine ? 'rgba(255,255,255,0.7)' : colors.textMuted}
                            strokeWidth={2}
                        />
                        <Text
                            style={[
                                styles.deletedText,
                                { color: mine ? 'rgba(255,255,255,0.7)' : colors.textMuted },
                            ]}
                        >
                            Média expiré (conservé 30 jours)
                        </Text>
                    </View>
                </View>
            </View>
        );
    }

    // Message supprimé : bulle neutre, aucune action
    if (message.supprime) {
        return (
            <View>
                {showDate && <DateSeparator date={message.createdAt} />}
                <View
                    style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
                >
                    <View style={styles.deletedRow}>
                        <Ban
                            size={13}
                            color={mine ? 'rgba(255,255,255,0.7)' : colors.textMuted}
                            strokeWidth={2}
                        />
                        <Text
                            style={[
                                styles.deletedText,
                                { color: mine ? 'rgba(255,255,255,0.7)' : colors.textMuted },
                            ]}
                        >
                            Message supprimé
                        </Text>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View>
            {showDate && <DateSeparator date={message.createdAt} />}
            <GestureDetector gesture={swipeGesture}>
                <Animated.View style={swipeStyle}>
                    {/* Indice « répondre » qui se révèle pendant le glissement */}
                    <Animated.View style={[styles.replyHint, replyHintStyle]}>
                        <Reply size={16} color={colors.primary} strokeWidth={2.2} />
                    </Animated.View>
                    <Pressable
                        onLongPress={onLongPress}
                        delayLongPress={280}
                        accessibilityHint="Appui long pour les actions, glisser à droite pour répondre"
                        style={[
                            styles.bubble,
                            mine ? styles.bubbleMine : styles.bubbleTheirs,
                            message.type !== 'text' && styles.bubbleMedia,
                        ]}
                    >
                {/* Citation (réponse à un message) */}
                {message.replyTo && (
                    <View
                        style={[
                            styles.quoteBlock,
                            { backgroundColor: mine ? 'rgba(255,255,255,0.14)' : colors.surfaceMuted },
                        ]}
                    >
                        <Text
                            style={[
                                styles.quoteText,
                                { color: mine ? 'rgba(255,255,255,0.85)' : colors.textSecondary },
                            ]}
                            numberOfLines={2}
                        >
                            {message.replyTo.supprime
                                ? 'Message supprimé'
                                : message.replyTo.type === 'image'
                                  ? '📷 Photo'
                                  : message.replyTo.type === 'audio'
                                    ? '🎤 Message vocal'
                                    : message.replyTo.type === 'location'
                                      ? '📍 Position'
                                      : (message.replyTo.contenu ?? '')}
                        </Text>
                    </View>
                )}

                {message.type === 'image' && message.mediaUrl ? (
                    mediaVisible ? (
                        <Pressable
                            onPress={() => onImagePress(message.mediaUrl!)}
                            onLongPress={onLongPress}
                            delayLongPress={280}
                            accessibilityRole="imagebutton"
                            accessibilityLabel="Agrandir la photo"
                        >
                            <Image
                                source={{ uri: optimizedImage(message.mediaUrl, { width: 600 }) }}
                                style={styles.imageContent}
                                cachePolicy="memory-disk"
                                transition={150}
                                contentFit="cover"
                                accessibilityLabel="Photo envoyée"
                            />
                        </Pressable>
                    ) : (
                        <MediaPlaceholder label="📷 Photo" mine={mine} onPress={onReveal} />
                    )
                ) : message.type === 'video' && message.mediaUrl ? (
                    mediaVisible ? (
                        <VideoBubble uri={message.mediaUrl} onLongPress={onLongPress} />
                    ) : (
                        <MediaPlaceholder
                            label={`🎥 Vidéo${message.mediaDuree ? ` · ${message.mediaDuree}s` : ''}`}
                            mine={mine}
                            onPress={onReveal}
                        />
                    )
                ) : message.type === 'location' &&
                  message.latitude != null &&
                  message.longitude != null ? (
                    <Pressable
                        onPress={() => {
                            suppressLock();
                            void Linking.openURL(
                                `geo:${message.latitude},${message.longitude}?q=${message.latitude},${message.longitude}`,
                            );
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Ouvrir la position dans Maps"
                    >
                        <View pointerEvents="none">
                            <LiveMap
                                point={{
                                    latitude: message.latitude,
                                    longitude: message.longitude,
                                }}
                                style={styles.locationContent}
                            />
                        </View>
                        <View style={styles.locationLabel}>
                            <MapPin size={12} color={colors.primary} strokeWidth={2.4} />
                            <Text style={styles.locationLabelText}>
                                Position partagée · toucher pour ouvrir
                            </Text>
                        </View>
                    </Pressable>
                ) : message.type === 'audio' && message.mediaUrl ? (
                    <AudioBubble
                        uri={message.mediaUrl}
                        duree={message.mediaDuree ?? 0}
                        mine={mine}
                        waveform={message.waveform}
                    />
                ) : (
                    <Text
                        style={[
                            styles.bubbleText,
                            { fontSize: fontSizes.base * fontScale },
                            mine && { color: '#FFFFFF' },
                        ]}
                    >
                        {message.contenu}
                    </Text>
                )}
                <View style={styles.bubbleMeta}>
                    {message.modifieAt && (
                        <Text
                            style={[
                                styles.bubbleTime,
                                mine && { color: 'rgba(255,255,255,0.75)' },
                            ]}
                        >
                            modifié ·
                        </Text>
                    )}
                    <Text style={[styles.bubbleTime, mine && { color: 'rgba(255,255,255,0.75)' }]}>
                        {heure}
                    </Text>
                    {mine &&
                        (message.pending ? (
                            // 🕐 en cours d'envoi
                            <Clock3 size={11} color="rgba(255,255,255,0.75)" strokeWidth={2.2} />
                        ) : message.lu ? (
                            // ✓✓ bleu = lu
                            <CheckCheck size={13} color="#7EE0FF" strokeWidth={2.4} />
                        ) : message.remis ? (
                            // ✓✓ gris = remis (destinataire en ligne, pas encore ouvert)
                            <CheckCheck size={13} color="rgba(255,255,255,0.8)" strokeWidth={2.4} />
                        ) : (
                            // ✓ = envoyé au serveur
                            <Check size={13} color="rgba(255,255,255,0.8)" strokeWidth={2.4} />
                        ))}
                </View>
                    </Pressable>
                </Animated.View>
            </GestureDetector>
        </View>
    );
}

/** Média masqué (téléchargement auto désactivé) : charger au toucher */
function MediaPlaceholder({
    label,
    mine,
    onPress,
}: {
    label: string;
    mine: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${label}, toucher pour afficher`}
            style={[
                styles.mediaPlaceholder,
                { backgroundColor: mine ? 'rgba(255,255,255,0.12)' : colors.surfaceMuted },
            ]}
        >
            <Text
                style={[
                    styles.mediaPlaceholderText,
                    { color: mine ? 'rgba(255,255,255,0.9)' : colors.textSecondary },
                ]}
            >
                {label}
            </Text>
            <Text
                style={[
                    styles.mediaPlaceholderHint,
                    { color: mine ? 'rgba(255,255,255,0.6)' : colors.textMuted },
                ]}
            >
                Toucher pour afficher
            </Text>
        </Pressable>
    );
}

/** Vidéo dans la bulle : lecteur natif + bouton plein écran explicite */
function VideoBubble({ uri, onLongPress }: { uri: string; onLongPress?: () => void }) {
    const viewRef = useRef<VideoView>(null);
    const player = useVideoPlayer(uri, (p) => {
        p.loop = false;
    });

    // UN TAP n'importe où = plein écran + lecture immédiate (style WhatsApp)
    const playFullscreen = () => {
        player.play();
        viewRef.current?.enterFullscreen();
    };

    return (
        <View>
            <VideoView
                ref={viewRef}
                player={player}
                style={styles.videoContent}
                nativeControls
                contentFit="cover"
                onFullscreenExit={() => player.pause()}
                accessibilityLabel="Vidéo envoyée"
            />
            {/* Surcouche : tap = plein écran + lecture ; appui long = menu d'actions */}
            <Pressable
                onPress={playFullscreen}
                onLongPress={onLongPress}
                delayLongPress={280}
                style={StyleSheet.absoluteFill}
                accessibilityRole="button"
                accessibilityLabel="Lire la vidéo en plein écran"
            >
                <View style={styles.videoPlayOverlay}>
                    <View style={styles.videoPlayButton}>
                        <Play size={22} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
                    </View>
                </View>
            </Pressable>
        </View>
    );
}

/** Pastille de date centrée (« mardi 7 juillet ») */
function DateSeparator({ date }: { date: string }) {
    return (
        <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>
                {new Date(date).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                })}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        ...shadows.card,
    },
    backButton: {
        width: 38,
        height: 38,
        borderRadius: radii.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerName: {
        fontFamily: typography.headingMedium,
        fontSize: fontSizes.md,
        color: colors.text,
        letterSpacing: -0.2,
    },
    headerStatus: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        marginTop: 1,
    },
    chatArea: {
        flex: 1,
        backgroundColor: '#E8EDF5', // fond de discussion (façon WhatsApp, teinté marque)
    },
    messages: {
        padding: spacing.lg,
        paddingBottom: spacing.xl,
        gap: 3,
    },
    emptyHint: {
        backgroundColor: '#FDF6DE',
        borderRadius: radii.md,
        padding: spacing.md,
        marginVertical: spacing.xl,
        alignSelf: 'center',
        maxWidth: '85%',
    },
    emptyHintText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 4,
        color: '#6B5D1F',
        textAlign: 'center',
    },
    dateSeparator: {
        alignSelf: 'center',
        backgroundColor: 'rgba(255,255,255,0.85)',
        borderRadius: radii.full,
        paddingHorizontal: spacing.md,
        paddingVertical: 3,
        marginVertical: spacing.md,
    },
    dateSeparatorText: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs - 1,
        color: colors.textSecondary,
        textTransform: 'capitalize',
    },
    bubble: {
        maxWidth: '85%',
        borderRadius: radii.lg,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm + 1,
        paddingBottom: spacing.xs + 1,
        marginBottom: 2,
        ...shadows.card,
        shadowOpacity: 0.04,
    },
    bubbleMine: {
        alignSelf: 'flex-end',
        backgroundColor: colors.primary,
        borderBottomRightRadius: radii.sm - 2,
    },
    bubbleTheirs: {
        alignSelf: 'flex-start',
        backgroundColor: '#FFFFFF',
        borderBottomLeftRadius: radii.sm - 2,
    },
    bubbleText: {
        fontFamily: typography.body,
        fontSize: fontSizes.base,
        lineHeight: lineHeights.base,
        color: colors.text,
    },
    bubbleMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 3,
        marginTop: 2,
    },
    bubbleTime: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs - 2,
        color: colors.textMuted,
    },
    contextBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
    },
    contextTitle: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
        color: colors.primary,
    },
    contextPreview: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: 1,
    },
    quoteBlock: {
        borderLeftWidth: 3,
        borderLeftColor: '#7EB6FF',
        borderRadius: radii.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs + 1,
        marginBottom: spacing.xs,
    },
    quoteText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
    },
    deletedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: 2,
    },
    deletedText: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        fontStyle: 'italic',
    },
    sheetBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15,23,42,0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        paddingVertical: spacing.md,
        paddingBottom: spacing['2xl'],
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg,
        paddingHorizontal: spacing['2xl'],
        height: 52,
    },
    actionLabel: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.md,
        color: colors.text,
    },
    attachSheet: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingVertical: spacing.lg,
    },
    attachOption: {
        alignItems: 'center',
        gap: spacing.sm,
    },
    attachIcon: {
        width: 54,
        height: 54,
        borderRadius: radii.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    attachLabel: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
    attachButton: {
        width: 44,
        height: 44,
        borderRadius: radii.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bubbleMedia: {
        paddingHorizontal: 4,
        paddingTop: 4,
        paddingBottom: spacing.xs + 1,
    },
    imageContent: {
        width: 216,
        height: 160,
        borderRadius: radii.md,
        backgroundColor: colors.surfaceMuted,
    },
    videoContent: {
        width: 216,
        height: 160,
        borderRadius: radii.md,
        backgroundColor: '#000',
        overflow: 'hidden',
    },
    mediaPlaceholder: {
        width: 216,
        height: 92,
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    mediaPlaceholderText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
    },
    mediaPlaceholderHint: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs - 1,
    },
    replyHint: {
        position: 'absolute',
        left: -2,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
    },
    locationContent: {
        width: 216,
        height: 120,
        borderRadius: radii.md,
        overflow: 'hidden',
    },
    locationLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingTop: spacing.xs,
    },
    locationLabelText: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs - 1,
        color: colors.textSecondary,
    },
    callButton: {
        width: 40,
        height: 40,
        borderRadius: radii.full,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    recordingInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
    },
    recordingDot: {
        width: 10,
        height: 10,
        borderRadius: radii.full,
        backgroundColor: palette.red600,
    },
    recordingText: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.base,
        color: colors.text,
        fontVariant: ['tabular-nums'],
    },
    // Oscillations du micro (une barre = 100 ms), alignées à droite pour
    // « défiler » vers la gauche comme WhatsApp
    waveRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 2,
        height: 28,
        overflow: 'hidden',
        marginLeft: spacing.sm,
    },
    waveBar: {
        width: 3,
        borderRadius: radii.full,
        backgroundColor: colors.primary,
    },
    audioRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        minWidth: 190,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.xs,
    },
    audioPlay: {
        width: 32,
        height: 32,
        borderRadius: radii.full,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Forme d'onde du vocal dans la bulle (barres, progression colorée)
    audioWave: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 26,
        overflow: 'hidden',
    },
    // Barres à largeur fixe réparties (space-between) : elles remplissent la
    // bulle façon WhatsApp et ne débordent jamais (28 barres tiennent à 85 %).
    audioWaveBar: {
        width: 3,
        borderRadius: radii.full,
    },
    audioDuration: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs - 1,
    },
    composer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    videoPlayOverlay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    videoPlayButton: {
        width: 54,
        height: 54,
        borderRadius: radii.full,
        backgroundColor: 'rgba(10,18,42,0.65)',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.85)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: 3, // centre optique du triangle ▶
    },
    composerInput: {
        flex: 1,
        fontFamily: typography.body,
        fontSize: fontSizes.md,
        color: colors.text,
        backgroundColor: colors.background,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.md,
        maxHeight: 120,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: radii.full,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.card,
    },
});
