import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TextInputProps,
    Pressable,
    StyleProp,
    ViewStyle,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors, radii, spacing, typography, fontSizes, TOUCH_TARGET } from '../../theme/tokens';

interface InputProps extends TextInputProps {
    label: string;
    error?: string;
    helper?: string;
    leftIcon?: React.ReactNode;
    containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Champ de saisie : label toujours visible, erreur sous le champ,
 * bascule œil pour les mots de passe, hauteur ≥ 48.
 */
export function Input({
    label,
    error,
    helper,
    leftIcon,
    secureTextEntry,
    containerStyle,
    ...rest
}: InputProps) {
    const [focused, setFocused] = useState(false);
    const [hidden, setHidden] = useState(!!secureTextEntry);

    const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

    return (
        <View style={containerStyle}>
            <Text style={styles.label}>{label}</Text>
            <View style={[styles.field, { borderColor, borderWidth: focused || error ? 1.5 : 1 }]}>
                {leftIcon}
                <TextInput
                    style={styles.input}
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={hidden}
                    onFocus={(e) => {
                        setFocused(true);
                        rest.onFocus?.(e);
                    }}
                    onBlur={(e) => {
                        setFocused(false);
                        rest.onBlur?.(e);
                    }}
                    accessibilityLabel={label}
                    {...rest}
                />
                {secureTextEntry && (
                    <Pressable
                        onPress={() => setHidden((h) => !h)}
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel={
                            hidden ? 'Afficher le mot de passe' : 'Masquer le mot de passe'
                        }
                    >
                        {hidden ? (
                            <EyeOff size={20} color={colors.textSecondary} strokeWidth={2} />
                        ) : (
                            <Eye size={20} color={colors.textSecondary} strokeWidth={2} />
                        )}
                    </Pressable>
                )}
            </View>
            {error ? (
                <Text style={styles.error} accessibilityLiveRegion="polite">
                    {error}
                </Text>
            ) : helper ? (
                <Text style={styles.helper}>{helper}</Text>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    label: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.text,
        marginBottom: spacing.xs + 2,
    },
    field: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radii.md,
        paddingHorizontal: spacing.lg,
        minHeight: TOUCH_TARGET + 4,
        gap: spacing.sm,
    },
    input: {
        flex: 1,
        fontFamily: typography.body,
        fontSize: fontSizes.md,
        color: colors.text,
        paddingVertical: spacing.md,
    },
    error: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.danger,
        marginTop: spacing.xs,
    },
    helper: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
});
