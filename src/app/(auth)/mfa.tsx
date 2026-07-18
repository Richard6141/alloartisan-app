import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import { useAuth } from '../../stores/auth';
import { ApiError } from '../../lib/api';
import { Button, Input } from '../../components/ui';
import { colors, spacing, typography, fontSizes, lineHeights, radii } from '../../theme/tokens';

/**
 * Seconde étape du login pour les comptes protégés par la double
 * authentification (2FA). On échange le `mfaToken` temporaire reçu au login
 * contre le code TOTP à 6 chiffres de l'application d'authentification.
 */
export default function MfaLoginScreen() {
    const router = useRouter();
    const { mfaToken } = useLocalSearchParams<{ mfaToken: string }>();
    const completeMfaLogin = useAuth((s) => s.completeMfaLogin);

    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const submit = async () => {
        if (code.trim().length !== 6) {
            setError('Saisissez le code à 6 chiffres de votre application');
            return;
        }
        if (!mfaToken) {
            setError('Session expirée. Reconnectez-vous.');
            return;
        }
        setError(null);
        setLoading(true);
        try {
            await completeMfaLogin(mfaToken, code.trim());
            // Le layout (auth) redirige tout seul vers les onglets une fois
            // le statut passé à « authenticated » : ne pas couper le spinner.
        } catch (e) {
            setError(e instanceof ApiError ? e.message : 'Code invalide ou expiré. Réessayez.');
            setLoading(false);
        }
    };

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
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.content}>
                    <View style={styles.icon}>
                        <ShieldCheck size={30} color={colors.primary} strokeWidth={2} />
                    </View>
                    <Text style={styles.title}>Vérification en deux étapes</Text>
                    <Text style={styles.subtitle}>
                        Ouvrez votre application d’authentification et saisissez le code à 6 chiffres
                        pour continuer.
                    </Text>

                    <Input
                        label="Code de vérification"
                        placeholder="123456"
                        keyboardType="number-pad"
                        value={code}
                        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        error={error ?? undefined}
                        autoFocus
                    />

                    <Button
                        title="Vérifier"
                        size="lg"
                        fullWidth
                        loading={loading}
                        onPress={submit}
                    />
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topBar: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
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
    content: {
        flex: 1,
        paddingHorizontal: spacing['2xl'],
        paddingTop: spacing['3xl'],
        gap: spacing.lg,
    },
    icon: {
        width: 64,
        height: 64,
        borderRadius: radii.full,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontFamily: typography.heading,
        fontSize: fontSizes['2xl'],
        color: colors.text,
        letterSpacing: -0.4,
    },
    subtitle: {
        fontFamily: typography.body,
        fontSize: fontSizes.base,
        lineHeight: lineHeights.base,
        color: colors.textSecondary,
        marginTop: -spacing.sm,
    },
});
