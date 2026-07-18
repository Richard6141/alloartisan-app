import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    Image,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck, ShieldOff, Lock } from 'lucide-react-native';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../stores/auth';
import { LoginInvite } from '../components/LoginInvite';
import { Button, Input, Card } from '../components/ui';
import { colors, palette, spacing, typography, fontSizes, lineHeights, radii } from '../theme/tokens';

/**
 * Double authentification (2FA / TOTP).
 * - Activation : le serveur génère un secret + un QR (data-URL) à scanner dans
 *   une application d'authentification (Google Authenticator, Authy…), puis on
 *   confirme avec un premier code à 6 chiffres.
 * - Désactivation : on confirme avec un code valide.
 */
export default function Securite2faScreen() {
    const router = useRouter();
    const status = useAuth((s) => s.status);

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
                <Text style={styles.title}>Double authentification</Text>
                <View style={{ width: 38 }} />
            </View>

            {status !== 'authenticated' ? (
                <LoginInvite
                    title="Double authentification"
                    message="Connectez-vous pour sécuriser votre compte avec la double authentification."
                />
            ) : (
                <Manager />
            )}
        </SafeAreaView>
    );
}

function Manager() {
    const user = useAuth((s) => s.user);
    const refreshUser = useAuth((s) => s.refreshUser);
    const enabled = user?.mfaEnabled === true;

    // Étape d'activation : null = pas commencé ; sinon on tient le secret + QR
    const [setup, setSetup] = useState<{ secret: string; qrCode: string } | null>(null);
    const [code, setCode] = useState('');
    const [disabling, setDisabling] = useState(false);

    const generate = useMutation({
        mutationFn: async () => {
            const { data } = await api.post<{ secret: string; qrCode: string }>(
                '/auth/mfa/generate',
            );
            return data;
        },
        onSuccess: (data) => {
            setSetup(data);
            setCode('');
        },
        onError: (e) =>
            Alert.alert('Impossible', e instanceof ApiError ? e.message : 'Réessayez plus tard.'),
    });

    const enable = useMutation({
        mutationFn: async () => {
            await api.post('/auth/mfa/enable', { code: code.trim() });
        },
        onSuccess: async () => {
            await refreshUser().catch(() => undefined);
            setSetup(null);
            setCode('');
            Alert.alert(
                'Activée ✅',
                'La double authentification est activée. Un code vous sera demandé à chaque connexion.',
            );
        },
        onError: (e) =>
            Alert.alert(
                'Code incorrect',
                e instanceof ApiError ? e.message : 'Le code est invalide ou expiré.',
            ),
    });

    const disable = useMutation({
        mutationFn: async () => {
            await api.post('/auth/mfa/disable', { code: code.trim() });
        },
        onSuccess: async () => {
            await refreshUser().catch(() => undefined);
            setDisabling(false);
            setCode('');
            Alert.alert('Désactivée', 'La double authentification a été désactivée.');
        },
        onError: (e) =>
            Alert.alert(
                'Code incorrect',
                e instanceof ApiError ? e.message : 'Le code est invalide ou expiré.',
            ),
    });

    const submitCode = (action: 'enable' | 'disable') => {
        if (code.trim().length !== 6) {
            Alert.alert('Code requis', 'Saisissez le code à 6 chiffres de votre application.');
            return;
        }
        if (action === 'enable') enable.mutate();
        else disable.mutate();
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {/* Bandeau d'état */}
                <View style={[styles.statusCard, enabled ? styles.statusOn : styles.statusOff]}>
                    {enabled ? (
                        <ShieldCheck size={22} color={palette.green700} strokeWidth={2} />
                    ) : (
                        <ShieldOff size={22} color={colors.textMuted} strokeWidth={2} />
                    )}
                    <View style={{ flex: 1 }}>
                        <Text style={styles.statusTitle}>
                            {enabled ? 'Activée' : 'Désactivée'}
                        </Text>
                        <Text style={styles.statusText}>
                            {enabled
                                ? 'Votre compte est protégé : un code est demandé à chaque connexion.'
                                : 'Ajoutez une couche de sécurité : un code temporaire en plus de votre mot de passe.'}
                        </Text>
                    </View>
                </View>

                {/* ─── COMPTE SANS 2FA ─── */}
                {!enabled && !setup && (
                    <>
                        <Card style={styles.infoCard}>
                            <Text style={styles.infoTitle}>Comment ça marche</Text>
                            <Text style={styles.infoStep}>
                                1. Installez une application d’authentification (Google
                                Authenticator, Authy…).
                            </Text>
                            <Text style={styles.infoStep}>
                                2. Scannez le QR code que nous générons.
                            </Text>
                            <Text style={styles.infoStep}>
                                3. Saisissez le code à 6 chiffres pour confirmer.
                            </Text>
                        </Card>
                        <Button
                            title="Activer la double authentification"
                            size="lg"
                            fullWidth
                            loading={generate.isPending}
                            onPress={() => generate.mutate()}
                        />
                    </>
                )}

                {/* ─── ÉTAPE D'ACTIVATION (QR + code) ─── */}
                {!enabled && setup && (
                    <Card style={styles.setupCard}>
                        <Text style={styles.infoTitle}>Scannez ce QR code</Text>
                        <View style={styles.qrWrap}>
                            <Image
                                source={{ uri: setup.qrCode }}
                                style={styles.qr}
                                resizeMode="contain"
                                accessibilityLabel="QR code de configuration"
                            />
                        </View>
                        <Text style={styles.secretHint}>
                            Impossible de scanner ? Saisissez cette clé manuellement :
                        </Text>
                        <Text style={styles.secret} selectable>
                            {setup.secret}
                        </Text>

                        <Input
                            label="Code de vérification"
                            placeholder="123456"
                            keyboardType="number-pad"
                            value={code}
                            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                            maxLength={6}
                            leftIcon={<Lock size={17} color={colors.textSecondary} strokeWidth={2} />}
                        />
                        <Button
                            title="Confirmer l’activation"
                            size="lg"
                            fullWidth
                            loading={enable.isPending}
                            onPress={() => submitCode('enable')}
                        />
                        <Button
                            title="Annuler"
                            variant="ghost"
                            fullWidth
                            onPress={() => {
                                setSetup(null);
                                setCode('');
                            }}
                        />
                    </Card>
                )}

                {/* ─── COMPTE AVEC 2FA ─── */}
                {enabled && (
                    <>
                        {!disabling ? (
                            <Button
                                title="Désactiver la double authentification"
                                variant="secondary"
                                size="lg"
                                fullWidth
                                onPress={() => {
                                    setDisabling(true);
                                    setCode('');
                                }}
                            />
                        ) : (
                            <Card style={styles.setupCard}>
                                <Text style={styles.infoTitle}>Confirmer la désactivation</Text>
                                <Text style={styles.infoStep}>
                                    Saisissez un code de votre application pour désactiver la 2FA.
                                </Text>
                                <Input
                                    label="Code de vérification"
                                    placeholder="123456"
                                    keyboardType="number-pad"
                                    value={code}
                                    onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                                    maxLength={6}
                                    leftIcon={
                                        <Lock size={17} color={colors.textSecondary} strokeWidth={2} />
                                    }
                                />
                                <Button
                                    title="Désactiver"
                                    variant="danger"
                                    size="lg"
                                    fullWidth
                                    loading={disable.isPending}
                                    onPress={() => submitCode('disable')}
                                />
                                <Button
                                    title="Annuler"
                                    variant="ghost"
                                    fullWidth
                                    onPress={() => {
                                        setDisabling(false);
                                        setCode('');
                                    }}
                                />
                            </Card>
                        )}
                    </>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
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
    title: {
        flex: 1,
        textAlign: 'center',
        fontFamily: typography.heading,
        fontSize: fontSizes.lg,
        color: colors.text,
        letterSpacing: -0.3,
    },
    content: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing['4xl'],
        gap: spacing.lg,
    },
    statusCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderRadius: radii.lg,
        padding: spacing.lg,
        borderWidth: 1,
    },
    statusOn: { backgroundColor: colors.successSoft, borderColor: 'transparent' },
    statusOff: { backgroundColor: colors.surface, borderColor: colors.border },
    statusTitle: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.base,
        color: colors.text,
    },
    statusText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 4,
        color: colors.textSecondary,
        marginTop: 2,
    },
    infoCard: { gap: spacing.sm },
    infoTitle: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.base,
        color: colors.text,
    },
    infoStep: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        lineHeight: lineHeights.sm + 3,
        color: colors.textSecondary,
    },
    setupCard: { gap: spacing.md },
    qrWrap: {
        alignSelf: 'center',
        backgroundColor: palette.white,
        padding: spacing.md,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    qr: { width: 200, height: 200 },
    secretHint: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    secret: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.md,
        letterSpacing: 2,
        color: colors.primary,
        textAlign: 'center',
    },
});
