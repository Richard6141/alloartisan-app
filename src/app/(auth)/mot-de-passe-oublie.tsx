import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    KeyboardAvoidingView,
    Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Mail, KeyRound, Lock } from 'lucide-react-native';
import { api, ApiError } from '../../lib/api';
import { Button, Input } from '../../components/ui';
import { colors, spacing, typography, fontSizes, lineHeights, radii } from '../../theme/tokens';

/**
 * Mot de passe oublié, en 2 étapes sur un seul écran :
 * 1. Email → le back envoie un code de réinitialisation
 * 2. Code + nouveau mot de passe → réinitialisation puis retour connexion
 */
export default function MotDePasseOublieScreen() {
    const router = useRouter();

    const [step, setStep] = useState<1 | 2>(1);
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const requestCode = async () => {
        if (!email.trim()) {
            setError('Saisissez votre adresse email');
            return;
        }
        setError(null);
        setLoading(true);
        try {
            await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
            setStep(2);
        } catch (e) {
            setError(e instanceof ApiError ? e.message : 'Envoi impossible. Réessayez.');
        } finally {
            setLoading(false);
        }
    };

    const resetPassword = async () => {
        if (code.trim().length < 4) {
            setError('Saisissez le code reçu par email');
            return;
        }
        if (password.length < 8) {
            setError('Le nouveau mot de passe doit contenir au moins 8 caractères');
            return;
        }
        setError(null);
        setLoading(true);
        try {
            await api.post('/auth/reset-password', {
                email: email.trim().toLowerCase(),
                code: code.trim(),
                newPassword: password,
            });
            Alert.alert(
                'Mot de passe changé ✅',
                'Connectez-vous avec votre nouveau mot de passe.',
                [{ text: 'Se connecter', onPress: () => router.replace('/(auth)/login') }],
            );
        } catch (e) {
            setError(e instanceof ApiError ? e.message : 'Réinitialisation impossible.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.topBar}>
                <Pressable
                    onPress={() => (step === 2 ? setStep(1) : router.back())}
                    hitSlop={12}
                    style={styles.backButton}
                    accessibilityRole="button"
                    accessibilityLabel="Retour"
                >
                    <ArrowLeft size={20} color={colors.text} strokeWidth={2.2} />
                </Pressable>
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Indicateur d'étape */}
                    <View style={styles.steps}>
                        <View style={[styles.stepDot, styles.stepDotActive]} />
                        <View style={[styles.stepLine, step === 2 && styles.stepDotActive]} />
                        <View style={[styles.stepDot, step === 2 && styles.stepDotActive]} />
                    </View>

                    {step === 1 ? (
                        <>
                            <Text style={styles.title}>Mot de passe oublié ?</Text>
                            <Text style={styles.subtitle}>
                                Pas de panique. Saisissez votre email : nous vous envoyons un code
                                de réinitialisation.
                            </Text>
                            <Input
                                label="Email"
                                placeholder="vous@exemple.com"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoComplete="email"
                                value={email}
                                onChangeText={setEmail}
                                error={error ?? undefined}
                                leftIcon={
                                    <Mail size={18} color={colors.textSecondary} strokeWidth={2} />
                                }
                            />
                            <Button
                                title="Recevoir le code"
                                size="lg"
                                fullWidth
                                loading={loading}
                                onPress={() => void requestCode()}
                            />
                        </>
                    ) : (
                        <>
                            <Text style={styles.title}>Nouveau mot de passe</Text>
                            <Text style={styles.subtitle}>
                                Un code a été envoyé à{' '}
                                <Text style={styles.emailStrong}>{email.trim()}</Text>. Saisissez-le
                                puis choisissez votre nouveau mot de passe.
                            </Text>
                            <Input
                                label="Code reçu par email"
                                placeholder="123456"
                                keyboardType="number-pad"
                                value={code}
                                onChangeText={setCode}
                                leftIcon={
                                    <KeyRound
                                        size={18}
                                        color={colors.textSecondary}
                                        strokeWidth={2}
                                    />
                                }
                            />
                            <Input
                                label="Nouveau mot de passe"
                                placeholder="••••••••"
                                secureTextEntry
                                autoComplete="new-password"
                                value={password}
                                onChangeText={setPassword}
                                error={error ?? undefined}
                                helper="8 caractères min., une majuscule, un chiffre, un caractère spécial"
                                leftIcon={
                                    <Lock size={18} color={colors.textSecondary} strokeWidth={2} />
                                }
                            />
                            <Button
                                title="Changer mon mot de passe"
                                size="lg"
                                fullWidth
                                loading={loading}
                                onPress={() => void resetPassword()}
                            />
                        </>
                    )}
                </ScrollView>
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
        paddingHorizontal: spacing['2xl'],
        paddingTop: spacing.xl,
        gap: spacing.xl,
    },
    steps: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        gap: spacing.xs,
    },
    stepDot: {
        width: 10,
        height: 10,
        borderRadius: radii.full,
        backgroundColor: colors.border,
    },
    stepLine: {
        width: 44,
        height: 3,
        borderRadius: radii.full,
        backgroundColor: colors.border,
    },
    stepDotActive: {
        backgroundColor: colors.primary,
    },
    title: {
        fontFamily: typography.heading,
        fontSize: fontSizes['2xl'],
        lineHeight: lineHeights['2xl'],
        color: colors.text,
        letterSpacing: -0.4,
    },
    subtitle: {
        fontFamily: typography.body,
        fontSize: fontSizes.base,
        lineHeight: lineHeights.base,
        color: colors.textSecondary,
        marginTop: -spacing.md,
    },
    emailStrong: {
        fontFamily: typography.bodySemiBold,
        color: colors.text,
    },
});
