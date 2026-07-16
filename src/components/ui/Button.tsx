import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Spinner } from './Spinner';
import { colors, radii, spacing, typography, fontSizes, TOUCH_TARGET } from '../../theme/tokens';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
type Size = 'lg' | 'md' | 'sm';

interface ButtonProps {
    title: string;
    onPress?: () => void;
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    disabled?: boolean;
    icon?: React.ReactNode;
    fullWidth?: boolean;
    haptic?: boolean;
    style?: StyleProp<ViewStyle>;
    accessibilityLabel?: string;
}

const VARIANTS: Record<Variant, { bg: string; bgPressed: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, bgPressed: colors.primaryPressed, fg: colors.onPrimary },
    accent: { bg: colors.accent, bgPressed: colors.accentPressed, fg: colors.onAccent },
    secondary: {
        bg: colors.surface,
        bgPressed: colors.surfaceMuted,
        fg: colors.primary,
        border: colors.borderStrong,
    },
    ghost: { bg: 'transparent', bgPressed: colors.surfaceMuted, fg: colors.primary },
    danger: { bg: colors.danger, bgPressed: '#991B1B', fg: colors.onPrimary },
};

const SIZES: Record<Size, { height: number; fontSize: number; paddingH: number }> = {
    lg: { height: 52, fontSize: fontSizes.md, paddingH: spacing['2xl'] },
    md: { height: TOUCH_TARGET, fontSize: fontSizes.base, paddingH: spacing.xl },
    sm: { height: 36, fontSize: fontSizes.sm, paddingH: spacing.lg },
};

export function Button({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    icon,
    fullWidth = false,
    haptic = true,
    style,
    accessibilityLabel,
}: ButtonProps) {
    const v = VARIANTS[variant];
    const s = SIZES[size];
    const inactive = disabled || loading;

    const handlePress = () => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
    };

    return (
        <Pressable
            onPress={inactive ? undefined : handlePress}
            disabled={inactive}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? title}
            accessibilityState={{ disabled: inactive, busy: loading }}
            style={({ pressed }) => [
                styles.base,
                {
                    backgroundColor: pressed ? v.bgPressed : v.bg,
                    height: s.height,
                    paddingHorizontal: s.paddingH,
                    borderWidth: v.border ? 1 : 0,
                    borderColor: v.border,
                    opacity: inactive ? 0.5 : 1,
                    alignSelf: fullWidth ? 'stretch' : 'auto',
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                },
                style,
            ]}
        >
            {/* En chargement : spinner animé (fiable sur Samsung) + libellé conservé */}
            {loading ? <Spinner size={s.fontSize + 2} color={v.fg} /> : icon}
            <Text
                style={[styles.label, { color: v.fg, fontSize: s.fontSize }]}
                numberOfLines={1}
            >
                {title}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.md,
        gap: spacing.sm,
    },
    label: {
        fontFamily: typography.bodySemiBold,
    },
});
