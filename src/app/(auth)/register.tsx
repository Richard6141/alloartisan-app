import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    KeyboardAvoidingView,
    ScrollView,
    Pressable,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, User, Wrench } from 'lucide-react-native';
import { Button, Input } from '../../components/ui';
import { BrandLogo } from '../../components/BrandLogo';
import { useAuth } from '../../stores/auth';
import { ApiError } from '../../lib/api';
import { colors, spacing, typography, fontSizes, lineHeights, radii } from '../../theme/tokens';

type Role = 'CLIENT' | 'ARTISAN';

function validatePassword(pwd: string): string | null {
    if (pwd.length < 8) return 'Au moins 8 caractères';
    if (!/[A-Z]/.test(pwd)) return 'Au moins une majuscule';
    if (!/[0-9]/.test(pwd)) return 'Au moins un chiffre';
    if (!/[^A-Za-z0-9]/.test(pwd)) return 'Au moins un caractère spécial (!, @, #…)';
    return null;
}

export default function RegisterScreen() {
    const router = useRouter();
    const register = useAuth((s) => s.register);

    const [role, setRole] = useState<Role>('CLIENT');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [pwdError, setPwdError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const submit = async () => {
        const pwdIssue = validatePassword(password);
        setPwdError(pwdIssue);
        if (!email.trim() || pwdIssue) return;

        setError(null);
        setLoading(true);
        try {
            const cleanEmail = email.trim().toLowerCase();
            await register({ email: cleanEmail, password, role });
            // Le spinner reste affiché jusqu'à l'écran OTP (pas de coupure)
            router.push({ pathname: '/(auth)/otp', params: { email: cleanEmail } });
            setLoading(false);
        } catch (e) {
            setError(e instanceof ApiError ? e.message : 'Inscription impossible. Réessayez.');
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.brand}>
                        <BrandLogo size={52} layout="column" tagline />
                    </View>
                    <Text style={[styles.title, { textAlign: 'center' }]}>Créer un compte</Text>
                    <Text style={[styles.subtitle, { textAlign: 'center' }]}>
                        Gratuit, en moins de 2 minutes.
                    </Text>

                    {/* Choix du rôle */}
                    <View style={styles.roleRow} accessibilityRole="radiogroup">
                        {(
                            [
                                { value: 'CLIENT', label: 'Je cherche un artisan', Icon: User },
                                { value: 'ARTISAN', label: 'Je suis artisan', Icon: Wrench },
                            ] as const
                        ).map(({ value, label, Icon }) => {
                            const selected = role === value;
                            return (
                                <Pressable
                                    key={value}
                                    onPress={() => setRole(value)}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected }}
                                    style={[styles.roleCard, selected && styles.roleCardSelected]}
                                >
                                    <Icon
                                        size={22}
                                        color={selected ? colors.primary : colors.textSecondary}
                                        strokeWidth={2}
                                    />
                                    <Text
                                        style={[
                                            styles.roleLabel,
                                            selected && { color: colors.primary },
                                        ]}
                                    >
                                        {label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    <View style={styles.form}>
                        <Input
                            label="Email"
                            placeholder="vous@exemple.com"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoComplete="email"
                            textContentType="emailAddress"
                            value={email}
                            onChangeText={setEmail}
                            leftIcon={<Mail size={18} color={colors.textSecondary} strokeWidth={2} />}
                        />
                        <Input
                            label="Mot de passe"
                            placeholder="••••••••"
                            secureTextEntry
                            autoComplete="new-password"
                            textContentType="newPassword"
                            value={password}
                            onChangeText={(v) => {
                                setPassword(v);
                                if (pwdError) setPwdError(validatePassword(v));
                            }}
                            error={pwdError ?? error ?? undefined}
                            helper="8 caractères min., une majuscule, un chiffre, un caractère spécial"
                            leftIcon={<Lock size={18} color={colors.textSecondary} strokeWidth={2} />}
                        />

                        <Button
                            title="Créer mon compte"
                            size="lg"
                            fullWidth
                            loading={loading}
                            onPress={submit}
                        />
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Déjà inscrit ?</Text>
                        <Link href="/(auth)/login" style={styles.footerLink}>
                            Se connecter
                        </Link>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: {
        flexGrow: 1,
        paddingHorizontal: spacing['2xl'],
        paddingTop: spacing['4xl'],
    },
    brand: {
        alignItems: 'center',
        alignSelf: 'stretch',
        marginBottom: spacing.xl,
    },
    title: {
        fontFamily: typography.heading,
        fontSize: fontSizes['3xl'],
        lineHeight: lineHeights['3xl'],
        color: colors.text,
    },
    subtitle: {
        fontFamily: typography.body,
        fontSize: fontSizes.md,
        color: colors.textSecondary,
        marginTop: spacing.sm,
        marginBottom: spacing['2xl'],
    },
    roleRow: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing['2xl'],
    },
    roleCard: {
        flex: 1,
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.sm,
        borderRadius: radii.lg,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    roleCardSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    roleLabel: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    form: { gap: spacing.xl },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.sm,
        marginTop: spacing['3xl'],
        paddingBottom: spacing['3xl'],
    },
    footerText: {
        fontFamily: typography.body,
        fontSize: fontSizes.base,
        color: colors.textSecondary,
    },
    footerLink: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.base,
        color: colors.primary,
    },
});
