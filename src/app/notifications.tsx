import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import {
    ArrowLeft,
    BellOff,
    CalendarDays,
    ChevronRight,
    Wallet,
    MessageCircle,
    Star,
    Gift,
    Bell,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useNotifications, useMarkAllRead } from '../features/notifications/hooks';
import { useAuth } from '../stores/auth';
import { LoginInvite } from '../components/LoginInvite';
import { Skeleton, EmptyState } from '../components/ui';
import type { AppNotification } from '../types/api';
import { colors, palette, spacing, typography, fontSizes, lineHeights, radii } from '../theme/tokens';

/** Icône + couleur par famille de notification */
function typeMeta(type: string): { Icon: LucideIcon; bg: string; fg: string } {
    if (type.startsWith('BOOKING')) return { Icon: CalendarDays, bg: colors.primarySoft, fg: colors.primary };
    if (type.startsWith('PAIEMENT')) return { Icon: Wallet, bg: '#DCFCE7', fg: '#15803D' };
    if (type.startsWith('MESSAGE')) return { Icon: MessageCircle, bg: '#CFFAFE', fg: '#0E7490' };
    if (type.startsWith('AVIS')) return { Icon: Star, bg: '#FEF3C7', fg: '#B45309' };
    if (type.startsWith('ABONNEMENT')) return { Icon: Gift, bg: '#FFE4E6', fg: '#BE123C' };
    return { Icon: Bell, bg: colors.surfaceMuted, fg: colors.textSecondary };
}

/** Destination d'une notification : l'élément concerné, pas juste la liste */
function destinationFor(n: AppNotification): { pathname: string; params?: Record<string, string> } | null {
    const d = (n.data ?? {}) as Record<string, unknown>;
    if (d.screen === 'justificatifs') return { pathname: '/justificatifs' };
    if (d.screen === 'activite') return { pathname: '/activite' };
    if (typeof d.bookingId === 'string') {
        return { pathname: '/booking/[id]', params: { id: d.bookingId } };
    }
    if (typeof d.conversationId === 'string') {
        return { pathname: '/conversation/[id]', params: { id: d.conversationId } };
    }
    if (n.type.startsWith('AVIS') || n.type.startsWith('ABONNEMENT')) {
        return { pathname: '/activite' };
    }
    return null;
}

function relativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return "À l'instant";
    if (minutes < 60) return `Il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Il y a ${days} j`;
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen() {
    const router = useRouter();
    const status = useAuth((s) => s.status);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.topBar}>
                <Pressable
                    onPress={() => router.back()}
                    hitSlop={12}
                    style={styles.backButton}
                    accessibilityRole="button"
                    accessibilityLabel="Retour"
                >
                    <ArrowLeft size={20} color={colors.text} strokeWidth={2.2} />
                </Pressable>
                <Text style={styles.title}>Notifications</Text>
                <View style={{ width: 38 }} />
            </View>

            {status !== 'authenticated' ? (
                <LoginInvite
                    title="Vos notifications"
                    message="Connectez-vous pour suivre vos réservations, paiements et messages en un coup d'œil."
                />
            ) : (
                <NotificationsList />
            )}
        </SafeAreaView>
    );
}

function NotificationsList() {
    const { data, isLoading } = useNotifications();
    const markAllRead = useMarkAllRead();

    // Tout marquer lu à l'ouverture (le point rouge de la cloche s'éteint)
    useEffect(() => {
        markAllRead.mutate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (isLoading && !data) {
        return (
            <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} height={72} borderRadius={radii.md} />
                ))}
            </View>
        );
    }

    if (!data || data.length === 0) {
        return (
            <EmptyState
                icon={<BellOff size={44} color={colors.textMuted} strokeWidth={1.5} />}
                title="Rien pour le moment"
                message="Vos rappels de rendez-vous, paiements et nouveautés apparaîtront ici."
            />
        );
    }

    return (
        <FlashList
            data={data}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
                paddingHorizontal: spacing.xl,
                paddingBottom: spacing['3xl'],
            }}
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
            renderItem={({ item }) => <NotificationRow notification={item} />}
        />
    );
}

function NotificationRow({ notification }: { notification: AppNotification }) {
    const router = useRouter();
    const { Icon, bg, fg } = typeMeta(notification.type);
    const destination = destinationFor(notification);

    return (
        <Pressable
            onPress={
                destination
                    ? () =>
                          router.push(
                              destination as unknown as Parameters<typeof router.push>[0],
                          )
                    : undefined
            }
            disabled={!destination}
            accessibilityRole={destination ? 'button' : undefined}
            style={({ pressed }) => [
                styles.row,
                !notification.lu && styles.rowUnread,
                pressed && destination != null && { opacity: 0.85 },
            ]}
        >
            <View style={[styles.rowIcon, { backgroundColor: bg }]}>
                <Icon size={17} color={fg} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
                <View style={styles.rowTop}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                        {notification.titre}
                    </Text>
                    {!notification.lu && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.rowBody} numberOfLines={2}>
                    {notification.corps}
                </Text>
                <Text style={styles.rowTime}>{relativeTime(notification.createdAt)}</Text>
            </View>
            {destination && (
                <ChevronRight
                    size={16}
                    color={colors.textMuted}
                    strokeWidth={2.2}
                    style={{ alignSelf: 'center' }}
                />
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
    },
    backButton: {
        width: 38,
        height: 38,
        borderRadius: radii.full,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    title: {
        flex: 1,
        textAlign: 'center',
        fontFamily: typography.heading,
        fontSize: fontSizes.lg,
        color: colors.text,
        letterSpacing: -0.3,
    },
    row: {
        flexDirection: 'row',
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
    },
    rowUnread: {
        borderColor: palette.navy100,
        backgroundColor: colors.primarySoft,
    },
    rowIcon: {
        width: 36,
        height: 36,
        borderRadius: radii.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    rowTitle: {
        flex: 1,
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    unreadDot: {
        width: 7,
        height: 7,
        borderRadius: radii.full,
        backgroundColor: palette.red600,
    },
    rowBody: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 3,
        color: colors.textSecondary,
    },
    rowTime: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs - 1,
        color: colors.textMuted,
        marginTop: 2,
    },
});
