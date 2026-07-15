import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LockKeyhole } from 'lucide-react-native';
import { Button } from './ui';
import { colors, spacing, typography, fontSizes, lineHeights, radii } from '../theme/tokens';

/** Invitation à se connecter, affichée sur les onglets protégés en mode invité */
export function LoginInvite({ title, message }: { title: string; message: string }) {
    const router = useRouter();
    return (
        <View style={styles.container}>
            <View style={styles.iconCircle}>
                <LockKeyhole size={32} color={colors.primary} strokeWidth={1.8} />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
            <Button
                title="Se connecter"
                size="lg"
                fullWidth
                onPress={() => router.push('/(auth)/login')}
            />
            <Button
                title="Créer un compte"
                variant="ghost"
                fullWidth
                onPress={() => router.push('/(auth)/register')}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing['3xl'],
        gap: spacing.md,
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: radii.full,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: spacing.sm,
    },
    title: {
        fontFamily: typography.heading,
        fontSize: fontSizes.xl,
        color: colors.text,
        textAlign: 'center',
    },
    message: {
        fontFamily: typography.body,
        fontSize: fontSizes.base,
        lineHeight: lineHeights.base,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
});
