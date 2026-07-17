import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock } from 'lucide-react-native';
import { Button, Input } from '../../components/ui';
import { AnimatedBrandLogo } from '../../components/BrandLogo';
import { useAuth } from '../../stores/auth';
import { ApiError } from '../../lib/api';
import { colors, spacing, typography, fontSizes, lineHeights } from '../../theme/tokens';

export default function LoginScreen() {
    const router = useRouter();
    const login = useAuth((s) => s.login);
    const loginWithGoogle = useAuth((s) => s.loginWithGoogle);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    const onGoogle = async () => {
        setError(null);
        setGoogleLoading(true);
        try {
            await loginWithGoogle();
            router.replace('/(tabs)');
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Connexion Google impossible.';
            // Ne pas afficher d'erreur si l'utilisateur a simplement annulé
            if (!/cancel|annul/i.test(msg)) setError(msg);
            setGoogleLoading(false);
        }
    };

    const submit = async () => {
        if (!email.trim() || !password) {
            setError('Saisissez votre email et votre mot de passe');
            return;
        }
        setError(null);
        setLoading(true);
        try {
            await login(email.trim().toLowerCase(), password);
            // Le spinner reste affiché pendant l'ouverture des onglets
            // (l'écran se démonte tout seul) : ne pas le couper ici
            router.replace('/(tabs)');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Connexion impossible. Réessayez.');
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
                        <AnimatedBrandLogo size={76} layout="column" tagline />
                    </View>
                    <Text style={[styles.title, styles.centered]}>Bon retour !</Text>
                    <Text style={[styles.subtitle, styles.centered]}>
                        Connectez-vous pour réserver et suivre vos interventions.
                    </Text>

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
                            autoComplete="password"
                            textContentType="password"
                            value={password}
                            onChangeText={setPassword}
                            error={error ?? undefined}
                            leftIcon={<Lock size={18} color={colors.textSecondary} strokeWidth={2} />}
                        />

                        <Link href="/(auth)/mot-de-passe-oublie" style={styles.forgotLink}>
                            Mot de passe oublié ?
                        </Link>

                        <Button
                            title="Se connecter"
                            size="lg"
                            fullWidth
                            loading={loading}
                            onPress={submit}
                        />

                        <View style={styles.separator}>
                            <View style={styles.line} />
                            <Text style={styles.separatorTxt}>ou</Text>
                            <View style={styles.line} />
                        </View>

                        <Button
                            title="Continuer avec Google"
                            variant="secondary"
                            size="lg"
                            fullWidth
                            loading={googleLoading}
                            onPress={onGoogle}
                        />
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Pas encore de compte ?</Text>
                        <Link href="/(auth)/register" style={styles.footerLink}>
                            Créer un compte
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
        paddingTop: spacing['5xl'],
    },
    brand: {
        alignItems: 'center',
        alignSelf: 'stretch',
        marginBottom: spacing['2xl'],
    },
    centered: {
        textAlign: 'center',
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
        lineHeight: lineHeights.md,
        color: colors.textSecondary,
        marginTop: spacing.sm,
        marginBottom: spacing['3xl'],
    },
    form: { gap: spacing.xl },
    separator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginVertical: -spacing.sm,
    },
    line: { flex: 1, height: 1, backgroundColor: colors.border },
    separatorTxt: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.textMuted,
    },
    forgotLink: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.primary,
        alignSelf: 'flex-end',
        marginTop: -spacing.md,
    },
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
