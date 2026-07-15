import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Fingerprint } from 'lucide-react-native';
import { useAuth } from '../stores/auth';
import { prefsStorage } from '../lib/storage';
import { Button } from './ui';
import { colors, spacing, typography, fontSizes, lineHeights, radii } from '../theme/tokens';

/**
 * Écran de verrouillage biométrique : demandé à l'ouverture de l'app
 * quand l'utilisateur a activé « Déverrouillage par empreinte ».
 */
export function LockScreen() {
    const unlock = useAuth((s) => s.unlock);
    const logout = useAuth((s) => s.logout);
    const router = useRouter();

    // Proposer l'empreinte immédiatement à l'arrivée
    useEffect(() => {
        void unlock();
    }, [unlock]);

    const usePassword = async () => {
        // Empreinte capricieuse : on désactive le verrou biométrique, on ferme
        // la session verrouillée PUIS on envoie explicitement vers l'écran de
        // connexion — sinon l'utilisateur retombait en navigation invité sans
        // qu'on lui demande son mot de passe.
        await prefsStorage.setBiometricLock(false);
        await logout();
        router.replace('/(auth)/login');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.brand}>AlloArtisan</Text>

                <View style={styles.iconCircle}>
                    <Fingerprint size={52} color={colors.primary} strokeWidth={1.6} />
                </View>

                <Text style={styles.title}>App verrouillée</Text>
                <Text style={styles.subtitle}>
                    Utilisez votre empreinte digitale pour accéder à votre compte.
                </Text>

                <Button
                    title="Déverrouiller"
                    size="lg"
                    fullWidth
                    onPress={() => void unlock()}
                />
                <Pressable onPress={usePassword} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.altLink}>Se connecter avec le mot de passe</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing['3xl'],
        gap: spacing.lg,
        alignItems: 'center',
    },
    brand: {
        fontFamily: typography.heading,
        fontSize: fontSizes.lg,
        color: colors.accent,
        marginBottom: spacing['2xl'],
    },
    iconCircle: {
        width: 108,
        height: 108,
        borderRadius: radii.full,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
    },
    title: {
        fontFamily: typography.heading,
        fontSize: fontSizes.xl,
        color: colors.text,
        letterSpacing: -0.3,
    },
    subtitle: {
        fontFamily: typography.body,
        fontSize: fontSizes.base,
        lineHeight: lineHeights.base,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    altLink: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.primary,
        padding: spacing.sm,
    },
});
