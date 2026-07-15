import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import { WifiOff } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useIsRestoring } from '@tanstack/react-query';
import { onlineManager } from '@tanstack/react-query';
import {
    colors,
    radii,
    spacing,
    typography,
    fontSizes,
    lineHeights,
    shadows,
} from '../../theme/tokens';

// ─── Card ────────────────────────────────────────────────────────────────────

export function Card({
    children,
    style,
}: {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}) {
    return <View style={[styles.card, style]}>{children}</View>;
}

// ─── Badge ───────────────────────────────────────────────────────────────────

type BadgeTone = 'primary' | 'success' | 'danger' | 'warning' | 'neutral' | 'accent';

const BADGE_TONES: Record<BadgeTone, { bg: string; fg: string }> = {
    primary: { bg: colors.primarySoft, fg: colors.primary },
    accent: { bg: colors.accentSoft, fg: colors.accentPressed },
    success: { bg: colors.successSoft, fg: '#047857' },
    danger: { bg: colors.dangerSoft, fg: '#B91C1C' },
    warning: { bg: colors.warningSoft, fg: '#92400E' },
    neutral: { bg: colors.surfaceMuted, fg: colors.textSecondary },
};

export function Badge({
    label,
    tone = 'neutral',
    icon,
}: {
    label: string;
    tone?: BadgeTone;
    icon?: React.ReactNode;
}) {
    const t = BADGE_TONES[tone];
    return (
        <View style={[styles.badge, { backgroundColor: t.bg }]}>
            {icon}
            <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
        </View>
    );
}

// ─── Avatar (photo ou initiales) ─────────────────────────────────────────────

export function Avatar({
    name,
    size = 44,
    uri,
}: {
    name?: string | null;
    size?: number;
    uri?: string | null;
}) {
    const initials = (name ?? '?')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join('');

    if (uri) {
        // expo-image gère le cache disque automatiquement
        return (
            <Image
                source={{ uri }}
                style={{ width: size, height: size, borderRadius: size / 2 }}
                cachePolicy="memory-disk"
                transition={150}
                accessibilityLabel={name ?? 'Photo de profil'}
            />
        );
    }

    return (
        <View
            style={[
                styles.avatarFallback,
                { width: size, height: size, borderRadius: size / 2 },
            ]}
            accessibilityLabel={name ?? 'Avatar'}
        >
            <Text style={[styles.avatarInitials, { fontSize: size * 0.38 }]}>{initials}</Text>
        </View>
    );
}

// ─── Skeleton (chargement progressif, jamais de spinner bloquant) ────────────

export function Skeleton({
    width,
    height = 16,
    borderRadius = radii.sm,
    style,
}: {
    width?: number | `${number}%`;
    height?: number;
    borderRadius?: number;
    style?: StyleProp<ViewStyle>;
}) {
    const opacity = useSharedValue(0.5);

    useEffect(() => {
        opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
    }, [opacity]);

    const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
        <Animated.View
            style={[
                { width: width ?? '100%', height, borderRadius, backgroundColor: colors.border },
                animatedStyle,
                style,
            ]}
        />
    );
}

// ─── EmptyState ──────────────────────────────────────────────────────────────

export function EmptyState({
    icon,
    title,
    message,
    action,
}: {
    icon?: React.ReactNode;
    title: string;
    message?: string;
    action?: React.ReactNode;
}) {
    return (
        <View style={styles.empty}>
            {icon}
            <Text style={styles.emptyTitle}>{title}</Text>
            {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
            {action}
        </View>
    );
}

// ─── Bannière hors ligne ─────────────────────────────────────────────────────

export function OfflineBanner() {
    const [online, setOnline] = React.useState(onlineManager.isOnline());
    const isRestoring = useIsRestoring();

    useEffect(() => onlineManager.subscribe(setOnline), []);

    if (online || isRestoring) return null;

    return (
        <View style={styles.offline} accessibilityLiveRegion="polite">
            <WifiOff size={14} color={colors.onDark} strokeWidth={2} />
            <Text style={styles.offlineText}>
                Hors ligne : vous consultez les dernières données enregistrées
            </Text>
        </View>
    );
}

// ─── Titres de section ───────────────────────────────────────────────────────

export function SectionTitle({
    title,
    action,
    style,
    titleStyle,
}: {
    title: string;
    action?: React.ReactNode;
    /** Style du conteneur (marges, padding horizontal…) */
    style?: StyleProp<ViewStyle>;
    titleStyle?: StyleProp<TextStyle>;
}) {
    return (
        <View style={[styles.sectionRow, style]}>
            <Text style={[styles.sectionTitle, titleStyle]}>{title}</Text>
            {action}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        padding: spacing.lg,
        ...shadows.card,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: spacing.xs,
        borderRadius: radii.full,
        alignSelf: 'flex-start',
    },
    badgeText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
    },
    avatarFallback: {
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitials: {
        fontFamily: typography.bodyBold,
        color: colors.primary,
    },
    empty: {
        alignItems: 'center',
        paddingVertical: spacing['5xl'],
        paddingHorizontal: spacing['3xl'],
        gap: spacing.md,
    },
    emptyTitle: {
        fontFamily: typography.headingMedium,
        fontSize: fontSizes.lg,
        color: colors.text,
        textAlign: 'center',
    },
    emptyMessage: {
        fontFamily: typography.body,
        fontSize: fontSizes.base,
        lineHeight: lineHeights.base,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    offline: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.text,
        paddingVertical: spacing.xs + 2,
        paddingHorizontal: spacing.lg,
    },
    offlineText: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        color: colors.onDark,
    },
    sectionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontFamily: typography.heading,
        fontSize: fontSizes.lg,
        color: colors.text,
    },
});
