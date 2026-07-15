import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { onlineManager } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Bell, MessageCircle } from 'lucide-react-native';
import { getSocket } from '../lib/socket';
import { queryKeys } from '../lib/queryClient';
import { useAuth } from '../stores/auth';
import { useChatPrefs } from '../stores/chatPrefs';
import type { AppNotification, Message } from '../types/api';
import { colors, palette, spacing, typography, fontSizes, radii, shadows } from '../theme/tokens';

interface BannerData {
    kind: 'notification' | 'message';
    titre: string;
    corps: string;
    /** Navigation au tap */
    conversationId?: string;
    senderNom?: string;
    bookingId?: string;
}

/**
 * Pont temps réel global + bannière in-app type WhatsApp :
 * - notifications serveur → rafraîchissement instantané (cloche, badges,
 *   listes, détail) + bannière tappable en haut de l'écran
 * - messages entrants → bannière « 💬 Jérôme : Bonjour… » où qu'on soit,
 *   badge Messages mis à jour dans la seconde
 */
export function RealtimeBridge() {
    const status = useAuth((s) => s.status);
    const userId = useAuth((s) => s.user?.id);
    const queryClient = useQueryClient();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [banner, setBanner] = useState<BannerData | null>(null);
    const [wsDown, setWsDown] = useState(false);
    const [online, setOnline] = useState(onlineManager.isOnline());
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const downTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const translateY = useSharedValue(-120);

    // Suivi de la connectivité réseau : quand l'appareil est franchement hors
    // ligne, c'est <OfflineBanner> qui informe — on n'affiche PAS en plus un
    // bandeau « temps réel » (doublon anxiogène). Le bandeau ci-dessous ne
    // concerne que le cas rare « en ligne mais socket temporairement coupé ».
    useEffect(() => onlineManager.subscribe(setOnline), []);

    const show = (data: BannerData) => {
        if (useChatPrefs.getState().haptics) {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setBanner(data);
        translateY.value = withSpring(0, { damping: 16, stiffness: 180 });
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(hide, 4500);
    };

    const hide = () => {
        translateY.value = withTiming(-120, { duration: 200 });
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setBanner(null), 220);
    };

    const bannerStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    useEffect(() => {
        if (status !== 'authenticated') return;
        let active = true;
        let socket: Socket | undefined;

        void (async () => {
            socket = await getSocket('/chat'); // la room user:{id} est jointe au handshake
            if (!active) return;

            // Panne temps réel VISIBLE (bandeau) au lieu de silencieuse —
            // avec 3 s de grâce pour ignorer les micro-coupures
            const markDown = () => {
                if (downTimer.current) clearTimeout(downTimer.current);
                downTimer.current = setTimeout(() => setWsDown(true), 3000);
            };
            const markUp = () => {
                if (downTimer.current) clearTimeout(downTimer.current);
                setWsDown(false);
            };
            socket.on('connect', markUp);
            socket.on('disconnect', markDown);
            socket.on('connect_error', markDown);
            if (!socket.connected) markDown();

            socket.on('notification:new', (notification: AppNotification) => {
                // Rafraîchir tout ce qui est concerné
                void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
                void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
                const bookingId = (notification.data as { bookingId?: string } | undefined)
                    ?.bookingId;
                if (bookingId) {
                    void queryClient.invalidateQueries({
                        queryKey: queryKeys.booking(bookingId),
                    });
                }
                // Décision admin (profil ou document) : l'écran de vérification
                // de l'artisan se met à jour en direct
                const screen = (notification.data as { screen?: string } | undefined)?.screen;
                if (screen === 'justificatifs' || screen === 'activite') {
                    void queryClient.invalidateQueries({ queryKey: ['artisan', 'me'] });
                    void queryClient.invalidateQueries({ queryKey: ['certifications', 'me'] });
                }
                show({
                    kind: 'notification',
                    titre: notification.titre,
                    corps: notification.corps,
                    bookingId,
                });
            });

            socket.on(
                'chat:incoming',
                (p: { conversationId: string; senderNom: string; message: Message }) => {
                    if (p.message.senderId === userId) return; // écho de mes envois
                    void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
                    void queryClient.invalidateQueries({
                        queryKey: ['messages', 'unread-count'],
                    });
                    void queryClient.invalidateQueries({
                        queryKey: queryKeys.messages(p.conversationId),
                    });
                    const preview =
                        p.message.type === 'image'
                            ? '📷 Photo'
                            : p.message.type === 'audio'
                              ? '🎤 Message vocal'
                              : p.message.type === 'location'
                                ? '📍 Position partagée'
                                : (p.message.contenu ?? '');
                    show({
                        kind: 'message',
                        titre: p.senderNom,
                        corps: preview,
                        conversationId: p.conversationId,
                        senderNom: p.senderNom,
                    });
                },
            );
        })();

        return () => {
            active = false;
            socket?.off('notification:new');
            socket?.off('chat:incoming');
            if (downTimer.current) clearTimeout(downTimer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, queryClient, userId]);

    // Le bandeau de reconnexion n'a de sens qu'EN LIGNE (sinon OfflineBanner suffit)
    const showReconnect = wsDown && online;
    if (!banner && !showReconnect) return null;

    if (!banner) {
        // Bandeau discret et neutre : reconnexion automatique en cours
        return (
            <View
                style={[styles.wsDownStrip, { top: insets.top + spacing.xs }]}
                pointerEvents="none"
                accessibilityLiveRegion="polite"
            >
                <Text style={styles.wsDownText}>Reconnexion…</Text>
            </View>
        );
    }

    const onPress = () => {
        hide();
        if (banner.conversationId) {
            router.push({
                pathname: '/conversation/[id]',
                params: { id: banner.conversationId, nom: banner.senderNom },
            });
        } else if (banner.bookingId) {
            router.push({ pathname: '/booking/[id]', params: { id: banner.bookingId } });
        } else {
            router.push('/notifications');
        }
    };

    return (
        <Animated.View
            style={[styles.banner, { top: insets.top + spacing.xs }, bannerStyle]}
            pointerEvents="box-none"
        >
            <Pressable
                onPress={onPress}
                style={styles.bannerInner}
                accessibilityRole="button"
                accessibilityLabel={`${banner.titre} : ${banner.corps}`}
            >
                <View
                    style={[
                        styles.bannerIcon,
                        {
                            backgroundColor:
                                banner.kind === 'message' ? '#CFFAFE' : colors.primarySoft,
                        },
                    ]}
                >
                    {banner.kind === 'message' ? (
                        <MessageCircle size={17} color="#0E7490" strokeWidth={2.2} />
                    ) : (
                        <Bell size={17} color={colors.primary} strokeWidth={2.2} />
                    )}
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.bannerTitle} numberOfLines={1}>
                        {banner.titre}
                    </Text>
                    <Text style={styles.bannerBody} numberOfLines={2}>
                        {banner.corps}
                    </Text>
                </View>
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    banner: {
        position: 'absolute',
        left: spacing.md,
        right: spacing.md,
        zIndex: 1000,
    },
    bannerInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.navy100,
        padding: spacing.md,
        ...shadows.raised,
    },
    bannerIcon: {
        width: 36,
        height: 36,
        borderRadius: radii.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bannerTitle: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    bannerBody: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: 1,
    },
    wsDownStrip: {
        position: 'absolute',
        alignSelf: 'center',
        zIndex: 999,
        backgroundColor: 'rgba(15,23,42,0.85)',
        borderRadius: radii.full,
        paddingHorizontal: spacing.md,
        paddingVertical: 4,
    },
    wsDownText: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs - 1,
        color: '#FFFFFF',
    },
});
