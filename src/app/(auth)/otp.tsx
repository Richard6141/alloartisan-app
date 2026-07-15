import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui';
import { useAuth } from '../../stores/auth';
import { api, ApiError } from '../../lib/api';
import { colors, spacing, typography, fontSizes, lineHeights, radii } from '../../theme/tokens';

const OTP_LENGTH = 6;
const RESEND_DELAY = 60;

export default function OtpScreen() {
    const router = useRouter();
    const { email } = useLocalSearchParams<{ email: string }>();
    const verifyOtp = useAuth((s) => s.verifyOtp);

    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [countdown, setCountdown] = useState(RESEND_DELAY);
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        if (countdown <= 0) return;
        const t = setInterval(() => setCountdown((c) => c - 1), 1000);
        return () => clearInterval(t);
    }, [countdown]);

    const submit = async (value: string) => {
        if (!email || value.length !== OTP_LENGTH) return;
        setError(null);
        setLoading(true);
        try {
            await verifyOtp(email, value);
            // Le spinner reste affiché pendant l'ouverture des onglets
            router.replace('/(tabs)');
        } catch (e) {
            setError(e instanceof ApiError ? e.message : 'Code invalide. Réessayez.');
            setCode('');
            setLoading(false);
        }
    };

    const resend = async () => {
        if (!email || countdown > 0) return;
        try {
            await api.post('/auth/new-otp-code', { email });
            setCountdown(RESEND_DELAY);
        } catch (e) {
            setError(e instanceof ApiError ? e.message : "Impossible de renvoyer le code");
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Vérifiez votre email</Text>
                <Text style={styles.subtitle}>
                    Un code à {OTP_LENGTH} chiffres a été envoyé à{'\n'}
                    <Text style={styles.email}>{email}</Text>
                </Text>

                {/* Champ invisible + cases visuelles */}
                <Pressable onPress={() => inputRef.current?.focus()} style={styles.otpRow}>
                    {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.otpBox,
                                i === code.length && styles.otpBoxActive,
                                error != null && styles.otpBoxError,
                            ]}
                        >
                            <Text style={styles.otpDigit}>{code[i] ?? ''}</Text>
                        </View>
                    ))}
                </Pressable>
                <TextInput
                    ref={inputRef}
                    value={code}
                    onChangeText={(v) => {
                        const clean = v.replace(/\D/g, '').slice(0, OTP_LENGTH);
                        setCode(clean);
                        setError(null);
                        if (clean.length === OTP_LENGTH) void submit(clean);
                    }}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete="sms-otp"
                    autoFocus
                    style={styles.hiddenInput}
                    accessibilityLabel="Code de vérification"
                />

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Button
                    title="Valider"
                    size="lg"
                    fullWidth
                    loading={loading}
                    disabled={code.length !== OTP_LENGTH}
                    onPress={() => submit(code)}
                    style={{ marginTop: spacing.xl }}
                />

                <Pressable onPress={resend} disabled={countdown > 0} style={styles.resend}>
                    <Text
                        style={[
                            styles.resendText,
                            countdown > 0 && { color: colors.textMuted },
                        ]}
                    >
                        {countdown > 0
                            ? `Renvoyer le code dans ${countdown}s`
                            : 'Renvoyer le code'}
                    </Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: {
        flex: 1,
        paddingHorizontal: spacing['2xl'],
        paddingTop: spacing['5xl'],
    },
    title: {
        fontFamily: typography.heading,
        fontSize: fontSizes['2xl'],
        color: colors.text,
    },
    subtitle: {
        fontFamily: typography.body,
        fontSize: fontSizes.md,
        lineHeight: lineHeights.md,
        color: colors.textSecondary,
        marginTop: spacing.sm,
        marginBottom: spacing['3xl'],
    },
    email: { fontFamily: typography.bodySemiBold, color: colors.text },
    otpRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        justifyContent: 'space-between',
    },
    otpBox: {
        flex: 1,
        aspectRatio: 0.85,
        maxWidth: 56,
        borderRadius: radii.md,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    otpBoxActive: { borderColor: colors.primary },
    otpBoxError: { borderColor: colors.danger },
    otpDigit: {
        fontFamily: typography.heading,
        fontSize: fontSizes.xl,
        color: colors.text,
    },
    hiddenInput: {
        position: 'absolute',
        opacity: 0,
        height: 1,
        width: 1,
    },
    error: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.danger,
        marginTop: spacing.md,
        textAlign: 'center',
    },
    resend: {
        alignSelf: 'center',
        marginTop: spacing.xl,
        padding: spacing.sm,
    },
    resendText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.base,
        color: colors.primary,
    },
});
