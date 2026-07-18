import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Switch,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import * as LocalAuthentication from 'expo-local-authentication';
import {
    ArrowLeft,
    ChevronRight,
    User as UserIcon,
    MapPin,
    Fingerprint,
    ShieldCheck,
    Trash2,
} from 'lucide-react-native';
import { api, ApiError } from '../lib/api';
import { prefsStorage } from '../lib/storage';
import { useAuth } from '../stores/auth';
import { LoginInvite } from '../components/LoginInvite';
import { PhoneInput, isPhoneComplete } from '../components/PhoneInput';
import { Button, Input, Card } from '../components/ui';
import { colors, spacing, typography, fontSizes, radii } from '../theme/tokens';

/** Paramètres du compte — modification du profil utilisateur */
export default function ParametresScreen() {
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
                <Text style={styles.title}>Paramètres du compte</Text>
                <View style={{ width: 38 }} />
            </View>

            {status !== 'authenticated' ? (
                <LoginInvite
                    title="Votre compte"
                    message="Connectez-vous pour modifier vos informations personnelles."
                />
            ) : (
                <SettingsForm />
            )}
        </SafeAreaView>
    );
}

function SettingsForm() {
    const router = useRouter();
    const user = useAuth((s) => s.user);
    const refreshUser = useAuth((s) => s.refreshUser);
    const isArtisan = user?.role === 'ARTISAN';

    const [prenom, setPrenom] = useState(user?.prenom ?? '');
    const [nom, setNom] = useState(user?.nom ?? '');
    const [telephone, setTelephone] = useState(user?.telephone ?? '');
    const [ville, setVille] = useState(user?.ville ?? '');
    const [quartier, setQuartier] = useState(user?.quartier ?? '');

    // Le store peut s'hydrater après le premier rendu : recale les champs
    // dès que le profil arrive (sinon Quartier & co restent vides)
    useEffect(() => {
        if (!user) return;
        setPrenom((v) => (v ? v : (user.prenom ?? '')));
        setNom((v) => (v ? v : (user.nom ?? '')));
        setTelephone((v) => (v ? v : (user.telephone ?? '')));
        setVille((v) => (v ? v : (user.ville ?? '')));
        setQuartier((v) => (v ? v : (user.quartier ?? '')));
    }, [user]);

    const save = useMutation({
        mutationFn: async () => {
            if (telephone.trim() && !isPhoneComplete(telephone)) {
                throw new ApiError(0, 'Numéro de téléphone incomplet : terminez-le ou videz le champ.');
            }
            await api.patch('/users/me', {
                prenom: prenom.trim() || undefined,
                nom: nom.trim() || undefined,
                telephone: telephone.trim() || undefined,
                // La localisation d'un artisan vit dans son profil pro
                ...(isArtisan
                    ? {}
                    : {
                          ville: ville.trim() || undefined,
                          quartier: quartier.trim() || undefined,
                      }),
            });
        },
        onSuccess: async () => {
            await refreshUser().catch(() => undefined);
            Alert.alert('Enregistré ✅', 'Vos informations ont été mises à jour.');
        },
        onError: (e) =>
            Alert.alert(
                'Enregistrement impossible',
                e instanceof ApiError ? e.message : 'Réessayez.',
            ),
    });

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.sectionLabel}>Identité</Text>
                <Input
                    label="Prénom"
                    placeholder="Votre prénom"
                    value={prenom}
                    onChangeText={setPrenom}
                    autoComplete="given-name"
                    leftIcon={<UserIcon size={17} color={colors.textSecondary} strokeWidth={2} />}
                />
                <Input
                    label="Nom"
                    placeholder="VOTRE NOM DE FAMILLE"
                    value={nom}
                    onChangeText={(v) => setNom(v.toUpperCase())}
                    autoCapitalize="characters"
                    autoComplete="family-name"
                    leftIcon={<UserIcon size={17} color={colors.textSecondary} strokeWidth={2} />}
                />
                <PhoneInput
                    label="Téléphone"
                    value={telephone}
                    onChangeValue={setTelephone}
                    helper="Utilisé par les artisans pour vous joindre le jour de l'intervention"
                />

                <Text style={styles.sectionLabel}>Sécurité</Text>
                <BiometricToggle />
                <Pressable
                    onPress={() => router.push('/securite-2fa')}
                    accessibilityRole="button"
                    accessibilityLabel="Double authentification"
                >
                    <Card style={styles.mfaCard}>
                        <ShieldCheck
                            size={20}
                            color={user?.mfaEnabled ? colors.success : colors.primary}
                            strokeWidth={2}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.bioTitle}>Double authentification</Text>
                            <Text style={styles.bioText}>
                                {user?.mfaEnabled
                                    ? 'Activée · un code est demandé à la connexion'
                                    : 'Ajoutez un code de sécurité à la connexion'}
                            </Text>
                        </View>
                        <ChevronRight size={17} color={colors.textMuted} strokeWidth={2.2} />
                    </Card>
                </Pressable>

                <Text style={styles.sectionLabel}>Localisation</Text>
                {isArtisan ? (
                    // Une information n'est saisie qu'UNE fois : la localisation
                    // d'un artisan vit dans son profil professionnel (GPS)
                    <Pressable
                        onPress={() => router.push('/profil-pro')}
                        accessibilityRole="button"
                    >
                        <Card style={styles.locationRedirect}>
                            <MapPin size={18} color={colors.primary} strokeWidth={2} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.locationRedirectTitle}>
                                    Gérée dans votre profil professionnel
                                </Text>
                                <Text style={styles.locationRedirectText}>
                                    Ville{user?.ville ? ` : ${user.ville}` : ''}. Elle suit votre
                                    position réelle, avec votre zone d'intervention
                                </Text>
                            </View>
                            <ChevronRight size={17} color={colors.textMuted} strokeWidth={2.2} />
                        </Card>
                    </Pressable>
                ) : (
                    <>
                        <Input
                            label="Ville"
                            placeholder="Cotonou, Abomey-Calavi…"
                            value={ville}
                            onChangeText={setVille}
                            leftIcon={
                                <MapPin size={17} color={colors.textSecondary} strokeWidth={2} />
                            }
                        />
                        <Input
                            label="Quartier"
                            placeholder="Fidjrossè, Akpakpa…"
                            value={quartier}
                            onChangeText={setQuartier}
                            leftIcon={
                                <MapPin size={17} color={colors.textSecondary} strokeWidth={2} />
                            }
                        />
                    </>
                )}

                <Button
                    title="Enregistrer"
                    size="lg"
                    fullWidth
                    loading={save.isPending}
                    onPress={() => save.mutate()}
                    style={{ marginTop: spacing.sm }}
                />

                <Text style={styles.emailNote}>
                    Connecté avec {user?.email}. L'adresse email ne peut pas être modifiée.
                </Text>

                <DangerZone />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

/** Zone dangereuse : suppression définitive du compte (mot de passe requis). */
function DangerZone() {
    const router = useRouter();
    const deleteAccount = useAuth((s) => s.deleteAccount);
    const mfaEnabled = useAuth((s) => s.user?.mfaEnabled === true);
    const [open, setOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [mfaCode, setMfaCode] = useState('');

    const del = useMutation({
        mutationFn: () => deleteAccount(password, mfaEnabled ? mfaCode.trim() : undefined),
        onSuccess: () => {
            Alert.alert('Compte supprimé', 'Votre compte a été supprimé. À bientôt.');
            router.replace('/(tabs)');
        },
        onError: (e) =>
            Alert.alert(
                'Suppression impossible',
                e instanceof ApiError ? e.message : 'Mot de passe incorrect ou erreur réseau.',
            ),
    });

    const confirm = () => {
        if (!password) {
            Alert.alert('Mot de passe requis', 'Saisissez votre mot de passe pour confirmer.');
            return;
        }
        if (mfaEnabled && mfaCode.trim().length !== 6) {
            Alert.alert('Code 2FA requis', 'Saisissez le code à 6 chiffres de votre application.');
            return;
        }
        Alert.alert(
            'Supprimer définitivement ?',
            'Cette action est irréversible. Vos données seront supprimées et vous serez déconnecté.',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: () => del.mutate(),
                },
            ],
        );
    };

    return (
        <View style={styles.dangerZone}>
            <Text style={styles.dangerLabel}>Zone dangereuse</Text>
            {!open ? (
                <Pressable
                    style={styles.dangerRow}
                    onPress={() => setOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Supprimer mon compte"
                >
                    <Trash2 size={18} color={colors.danger} strokeWidth={2} />
                    <Text style={styles.dangerRowTxt}>Supprimer mon compte</Text>
                </Pressable>
            ) : (
                <View style={styles.dangerBox}>
                    <Text style={styles.dangerHint}>
                        La suppression est définitive. Confirmez avec votre mot de passe.
                    </Text>
                    <Input
                        label="Mot de passe"
                        placeholder="Votre mot de passe"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoCapitalize="none"
                    />
                    {mfaEnabled && (
                        <Input
                            label="Code 2FA"
                            placeholder="123456"
                            keyboardType="number-pad"
                            value={mfaCode}
                            onChangeText={(v) => setMfaCode(v.replace(/\D/g, '').slice(0, 6))}
                            maxLength={6}
                        />
                    )}
                    <View style={styles.dangerActions}>
                        <Button
                            title="Annuler"
                            variant="secondary"
                            onPress={() => {
                                setOpen(false);
                                setPassword('');
                            }}
                            style={{ flex: 1 }}
                        />
                        <Button
                            title="Supprimer"
                            variant="danger"
                            loading={del.isPending}
                            onPress={confirm}
                            style={{ flex: 1 }}
                        />
                    </View>
                </View>
            )}
        </View>
    );
}

// Les réglages des discussions vivent désormais sur l'écran Messages
// (engrenage en haut à droite), comme WhatsApp.

/**
 * Interrupteur « Déverrouillage par empreinte ».
 * L'activation exige une empreinte valide (on prouve qu'elle fonctionne
 * AVANT de verrouiller l'app avec).
 */
function BiometricToggle() {
    const [available, setAvailable] = useState(false);
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        void (async () => {
            const [hardware, enrolled, saved] = await Promise.all([
                LocalAuthentication.hasHardwareAsync(),
                LocalAuthentication.isEnrolledAsync(),
                prefsStorage.isBiometricLockEnabled(),
            ]);
            setAvailable(hardware && enrolled);
            setEnabled(saved);
        })();
    }, []);

    const toggle = async (value: boolean) => {
        if (value) {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Confirmez votre empreinte pour activer le verrouillage',
                cancelLabel: 'Annuler',
            });
            if (!result.success) return;
        }
        await prefsStorage.setBiometricLock(value);
        setEnabled(value);
    };

    if (!available) {
        return (
            <Card style={styles.bioCard}>
                <Fingerprint size={20} color={colors.textMuted} strokeWidth={2} />
                <Text style={styles.bioUnavailable}>
                    Aucune empreinte enregistrée sur ce téléphone. Ajoutez-en une dans les
                    réglages Android pour activer le déverrouillage biométrique.
                </Text>
            </Card>
        );
    }

    return (
        <Card style={styles.bioCard}>
            <Fingerprint size={20} color={colors.primary} strokeWidth={2} />
            <View style={{ flex: 1 }}>
                <Text style={styles.bioTitle}>Déverrouillage par empreinte</Text>
                <Text style={styles.bioText}>
                    Votre empreinte sera demandée à chaque ouverture de l'app
                </Text>
            </View>
            <Switch
                value={enabled}
                onValueChange={(v) => void toggle(v)}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.surface}
            />
        </Card>
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
    sectionLabel: {
        fontFamily: typography.heading,
        fontSize: fontSizes.base,
        color: colors.text,
        marginTop: spacing.sm,
    },
    locationRedirect: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    locationRedirectTitle: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    locationRedirectText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: 1,
    },
    emailNote: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: spacing.sm,
    },
    bioCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    mfaCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    bioTitle: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.base,
        color: colors.text,
    },
    bioText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: 1,
    },
    bioUnavailable: {
        flex: 1,
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
    dangerZone: {
        marginTop: spacing.xl,
        paddingTop: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        gap: spacing.sm,
    },
    dangerLabel: {
        fontFamily: typography.heading,
        fontSize: fontSizes.base,
        color: colors.danger,
    },
    dangerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.dangerSoft,
        backgroundColor: colors.dangerSoft,
    },
    dangerRowTxt: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.danger,
    },
    dangerBox: { gap: spacing.md },
    dangerHint: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    dangerActions: {
        flexDirection: 'row',
        gap: spacing.md,
    },
});
