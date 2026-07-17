import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { LiveMap } from '../../components/LiveMap';
import type { Socket } from 'socket.io-client';
import { ArrowLeft, MapPin, Clock, Radio, Navigation } from 'lucide-react-native';
import { openExternalNavigation } from '../../lib/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../../stores/auth';
import { Badge, Button } from '../../components/ui';
import type { LivePosition, TrackingPhase, TrackingState } from '../../types/api';
import { colors, palette, spacing, typography, fontSizes, radii, shadows } from '../../theme/tokens';

/** Distance haversine en mètres (affichage local côté artisan) */
function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const PHASE_LABELS: Record<TrackingPhase, { label: string; tone: 'primary' | 'success' | 'accent' | 'neutral' }> = {
    EN_ROUTE: { label: '🛵 En route', tone: 'accent' },
    ARRIVE: { label: '📍 Arrivé', tone: 'primary' },
    EN_INTERVENTION: { label: '🔧 Intervention en cours', tone: 'success' },
    TERMINE: { label: '✅ Terminé', tone: 'neutral' },
};

export default function TrackingScreen() {
    const { bookingId, mode } = useLocalSearchParams<{ bookingId: string; mode?: string }>();
    const router = useRouter();
    const roleIsArtisan = useAuth((s) => s.user?.role === 'ARTISAN');
    // Perspective RÉELLE dans cette mission : passée par l'écran mission (qui la
    // déduit de la relation client/artisan). Un artisan peut être le CLIENT d'un
    // confrère → se fier au rôle global ferait émettre le GPS et le serveur
    // refuserait (« suivi impossible »). Fallback rôle global si on arrive ici
    // par une notification (pas de param).
    const isArtisan = mode ? mode === 'artisan' : roleIsArtisan;

    const [position, setPosition] = useState<LivePosition | null>(null);
    const [phase, setPhase] = useState<TrackingPhase | null>(null);
    const [sharing, setSharing] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    // Cold start + REPLI : dernier état connu via REST, re-lu toutes les 10 s
    // (le suivi fonctionne même si le canal temps réel a un problème)
    const { data: initial } = useQuery({
        queryKey: queryKeys.tracking(bookingId),
        queryFn: async () => {
            const { data } = await api.get<TrackingState>(`/tracking/${bookingId}`);
            return data;
        },
        refetchInterval: isArtisan ? false : 10000,
    });

    useEffect(() => {
        if (initial && !isArtisan) {
            // REST et WebSocket lisent la même source (Redis) : on applique
            // toujours la donnée la plus récente reçue
            if (initial.position) setPosition(initial.position);
            if (initial.phase) setPhase(initial.phase);
        } else if (initial && isArtisan && initial.phase) {
            setPhase((prev) => prev ?? initial.phase);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initial]);

    // CLIENT : flux temps réel entrant via WebSocket /tracking
    useEffect(() => {
        if (isArtisan) return;
        let socket: Socket | undefined;
        let active = true;

        void (async () => {
            socket = await getSocket('/tracking');
            if (!active) return;

            const subscribe = () => socket?.emit('subscribe_tracking', { bookingId });

            socket.on('connect', subscribe);
            if (socket.connected) subscribe();

            socket.on('tracking:state', (state: TrackingState) => {
                if (state.position) setPosition(state.position);
                if (state.phase) setPhase(state.phase);
            });
            socket.on('tracking:position', (pos: LivePosition) => setPosition(pos));
            socket.on('tracking:phase', (p: { phase: TrackingPhase }) => setPhase(p.phase));
        })();

        return () => {
            active = false;
            socket?.emit('unsubscribe_tracking', { bookingId });
            socket?.off('tracking:state');
            socket?.off('tracking:position');
            socket?.off('tracking:phase');
        };
    }, [bookingId, isArtisan]);

    // ARTISAN : émission de la position GPS tant que l'écran est ouvert
    useEffect(() => {
        if (!isArtisan) return;
        let subscription: Location.LocationSubscription | undefined;
        let active = true;

        void (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Position requise',
                    'Autorisez la localisation pour que le client puisse vous suivre.',
                );
                return;
            }
            const socket = await getSocket('/tracking');
            if (!active) return;
            socketRef.current = socket;
            setSharing(true);

            // Les refus serveur ne doivent plus être silencieux
            socket.on('error', (e: { message?: string }) => {
                Alert.alert(
                    'Suivi impossible',
                    e?.message ?? 'Le serveur a refusé le partage de position.',
                );
            });

            // « Je pars » = EN ROUTE : le client est prévenu immédiatement,
            // sans que l'artisan ait besoin d'un second tap
            setPhase((prev) => {
                if (!prev) {
                    socket.emit('phase_update', { bookingId, phase: 'EN_ROUTE' });
                    return 'EN_ROUTE';
                }
                return prev;
            });

            subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 4000,
                    distanceInterval: 10,
                },
                (loc) => {
                    const payload = {
                        bookingId,
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                        heading: loc.coords.heading ?? undefined,
                        speed: loc.coords.speed ?? undefined,
                        accuracy: loc.coords.accuracy ?? undefined,
                    };
                    socketRef.current?.emit('position_update', payload);
                    // Affichage local immédiat (distance calculée sur place)
                    setPosition({
                        bookingId,
                        latitude: payload.latitude,
                        longitude: payload.longitude,
                        heading: payload.heading,
                        updatedAt: new Date().toISOString(),
                    });
                },
            );
        })();

        return () => {
            active = false;
            subscription?.remove();
            socketRef.current?.off('error');
            setSharing(false);
        };
    }, [bookingId, isArtisan]);

    // ARTISAN : annoncer une phase (En route / Arrivé)
    const sendPhase = (newPhase: TrackingPhase) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        socketRef.current?.emit('phase_update', { bookingId, phase: newPhase });
        setPhase(newPhase);
    };

    const destination = initial?.destination;
    const phaseMeta = phase ? PHASE_LABELS[phase] : null;

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Carte OpenStreetMap (WebView) : artisan, destination, itinéraire */}
            <LiveMap
                artisan={
                    position
                        ? { latitude: position.latitude, longitude: position.longitude }
                        : null
                }
                destination={destination}
                style={StyleSheet.absoluteFill}
            />

            {/* Barre supérieure */}
            <SafeAreaView edges={['top']} style={styles.topOverlay} pointerEvents="box-none">
                <Pressable
                    onPress={() => router.back()}
                    style={styles.backButton}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Retour"
                >
                    <ArrowLeft size={22} color={colors.text} strokeWidth={2} />
                </Pressable>
                {phaseMeta && <Badge label={phaseMeta.label} tone={phaseMeta.tone} />}
            </SafeAreaView>

            {/* Panneau d'infos — ARTISAN (émetteur) */}
            {isArtisan ? (
                <View style={styles.bottomPanel}>
                    <View style={styles.sharingRow}>
                        <Radio
                            size={16}
                            color={sharing ? palette.green600 : colors.textMuted}
                            strokeWidth={2.2}
                        />
                        <Text style={styles.panelTitle}>
                            {sharing ? 'Position partagée en direct' : 'Activation du GPS…'}
                        </Text>
                    </View>
                    {position && destination && (
                        <Text style={styles.panelHint}>
                            {(() => {
                                const d = haversineMetres(
                                    position.latitude,
                                    position.longitude,
                                    destination.latitude,
                                    destination.longitude,
                                );
                                return d >= 1000
                                    ? `${(d / 1000).toFixed(1)} km du lieu d'intervention`
                                    : `${Math.round(d)} m du lieu d'intervention`;
                            })()}
                        </Text>
                    )}
                    {destination && (
                        <Pressable
                            style={styles.itinButton}
                            onPress={() => openExternalNavigation(destination)}
                            accessibilityRole="button"
                            accessibilityLabel="Lancer l'itinéraire vers le client"
                        >
                            <Navigation size={18} color={palette.white} strokeWidth={2.2} />
                            <Text style={styles.itinButtonTxt}>Itinéraire vers le client</Text>
                        </Pressable>
                    )}
                    <View style={styles.phaseButtons}>
                        <Button
                            title="🛵 En route"
                            variant={phase === 'EN_ROUTE' ? 'primary' : 'secondary'}
                            onPress={() => sendPhase('EN_ROUTE')}
                            style={{ flex: 1 }}
                        />
                        <Button
                            title="📍 Arrivé"
                            variant={phase === 'ARRIVE' ? 'primary' : 'secondary'}
                            onPress={() => sendPhase('ARRIVE')}
                            style={{ flex: 1 }}
                        />
                    </View>
                    {phase === 'EN_ROUTE' && (
                        <Text style={styles.phaseConfirm}>
                            ✓ Le client a été notifié : il vous voit arriver sur sa carte.
                        </Text>
                    )}
                    {phase === 'ARRIVE' && (
                        <Text style={styles.phaseConfirm}>
                            ✓ Le client sait que vous êtes arrivé.
                        </Text>
                    )}
                    <Text style={styles.panelNote}>
                        Gardez cet écran ouvert pendant le trajet : le client vous suit sur la
                        carte et reçoit une notification à chaque étape.
                    </Text>
                </View>
            ) : (
            <View style={styles.bottomPanel}>
                <Text style={styles.panelTitle}>
                    {phase === 'ARRIVE'
                        ? 'Votre artisan est arrivé 🎉'
                        : phase === 'EN_INTERVENTION'
                          ? 'Intervention en cours'
                          : phase === 'TERMINE'
                            ? 'Intervention terminée'
                            : position
                              ? 'Votre artisan arrive'
                              : "En attente du départ de l'artisan…"}
                </Text>

                {position ? (
                    <View style={styles.metrics}>
                        {position.etaMinutes != null && (
                            <View style={styles.metric}>
                                <Clock size={18} color={colors.primary} strokeWidth={2} />
                                <Text style={styles.metricValue}>~{position.etaMinutes} min</Text>
                                <Text style={styles.metricLabel}>arrivée estimée</Text>
                            </View>
                        )}
                        {position.distanceMetres != null && (
                            <View style={styles.metric}>
                                <MapPin size={18} color={colors.primary} strokeWidth={2} />
                                <Text style={styles.metricValue}>
                                    {position.distanceMetres >= 1000
                                        ? `${(position.distanceMetres / 1000).toFixed(1)} km`
                                        : `${position.distanceMetres} m`}
                                </Text>
                                <Text style={styles.metricLabel}>distance restante</Text>
                            </View>
                        )}
                    </View>
                ) : (
                    <Text style={styles.panelHint}>
                        La position s'affichera dès que l'artisan activera son mode « En route ».
                        Vous recevrez une notification.
                    </Text>
                )}
            </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.sm,
    },
    backButton: {
        width: 42,
        height: 42,
        borderRadius: radii.full,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.raised,
    },
    bottomPanel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        padding: spacing['2xl'],
        paddingBottom: spacing['3xl'],
        gap: spacing.lg,
        ...shadows.raised,
    },
    panelTitle: {
        fontFamily: typography.heading,
        fontSize: fontSizes.lg,
        color: colors.text,
    },
    panelHint: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    sharingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    itinButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.primary,
        borderRadius: radii.lg,
        paddingVertical: spacing.md,
    },
    itinButtonTxt: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.base,
        color: palette.white,
    },
    phaseButtons: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    phaseConfirm: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        color: palette.green700,
    },
    panelNote: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: 17,
        color: colors.textMuted,
    },
    metrics: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    metric: {
        flex: 1,
        alignItems: 'center',
        gap: 2,
        backgroundColor: colors.primarySoft,
        borderRadius: radii.md,
        paddingVertical: spacing.md,
    },
    metricValue: {
        fontFamily: typography.heading,
        fontSize: fontSizes.lg,
        color: colors.primary,
    },
    metricLabel: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
});
