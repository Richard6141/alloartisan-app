import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Camera, User as UserIcon, MapPin, LocateFixed } from 'lucide-react-native';
import { api, ApiError } from '../lib/api';
import { suppressLock } from '../lib/lockGuard';
import { resolvePosition } from '../lib/geo';
import { PhoneInput, isPhoneComplete } from '../components/PhoneInput';
import { useAuth } from '../stores/auth';
import { LoginInvite } from '../components/LoginInvite';
import { Avatar, Button, Input } from '../components/ui';
import { colors, spacing, typography, fontSizes, lineHeights, radii } from '../theme/tokens';

/**
 * Assistant de complétion de profil : petites étapes conviviales
 * (photo, identité, téléphone, adresse) avec barre de progression.
 * Chaque étape est facultative sauf l'identité : on peut passer.
 *
 * ASSAINISSEMENT : un artisan gère sa localisation UNIQUEMENT dans son
 * profil professionnel (dérivée du GPS) — l'étape Adresse ne lui est
 * jamais demandée ici, l'information n'est saisie qu'une fois.
 */
export default function CompleterProfilScreen() {
    const router = useRouter();
    const status = useAuth((s) => s.status);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            {status !== 'authenticated' ? (
                <LoginInvite
                    title="Votre profil"
                    message="Connectez-vous pour compléter votre profil."
                />
            ) : (
                <Wizard onDone={() => router.back()} onBack={() => router.back()} />
            )}
        </SafeAreaView>
    );
}

function Wizard({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
    const user = useAuth((s) => s.user);
    const refreshUser = useAuth((s) => s.refreshUser);
    const isArtisan = user?.role === 'ARTISAN';
    const STEPS = isArtisan
        ? (['Photo', 'Identité', 'Contact'] as const)
        : (['Photo', 'Identité', 'Contact', 'Adresse'] as const);

    const [step, setStep] = useState(0);
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [prenom, setPrenom] = useState(user?.prenom ?? '');
    const [nom, setNom] = useState(user?.nom ?? '');
    const [telephone, setTelephone] = useState(user?.telephone ?? '');
    const [ville, setVille] = useState(user?.ville ?? '');
    const [quartier, setQuartier] = useState(user?.quartier ?? '');
    const [locating, setLocating] = useState(false);
    const autoLocated = useRef(false);

    // À l'arrivée sur l'étape Adresse : pré-remplir depuis la position si la
    // permission est déjà accordée (silencieux, sans écraser une saisie)
    useEffect(() => {
        if (step !== 3 || autoLocated.current) return;
        autoLocated.current = true;
        if (ville.trim() && quartier.trim()) return;
        void resolvePosition({ request: false }).then((pos) => {
            if (!pos) return;
            if (pos.ville) setVille((v) => (v.trim() ? v : pos.ville!));
            if (pos.quartier) setQuartier((q) => (q.trim() ? q : pos.quartier!));
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]);

    const useMyLocation = async () => {
        setLocating(true);
        const pos = await resolvePosition();
        setLocating(false);
        if (!pos) {
            Alert.alert(
                'Position indisponible',
                'Autorisez la localisation ou saisissez votre adresse manuellement.',
            );
            return;
        }
        if (pos.ville) setVille(pos.ville);
        if (pos.quartier) setQuartier(pos.quartier);
    };

    const pickPhoto = async (fromCamera: boolean) => {
        suppressLock(); // galerie/caméra : pas de verrou empreinte au retour
        const picked = fromCamera
            ? await (async () => {
                  const perm = await ImagePicker.requestCameraPermissionsAsync();
                  if (!perm.granted) return null;
                  return ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1] });
              })()
            : await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ['images'],
                  quality: 0.7,
                  allowsEditing: true,
                  aspect: [1, 1],
              });
        if (picked && !picked.canceled && picked.assets?.[0]) {
            setPhotoUri(picked.assets[0].uri);
        }
    };

    const save = useMutation({
        mutationFn: async () => {
            // 1. Uploader la photo si une nouvelle a été choisie
            let photoUrl: string | undefined;
            if (photoUri) {
                const form = new FormData();
                form.append('file', {
                    uri: photoUri,
                    name: 'profil.jpg',
                    type: 'image/jpeg',
                } as unknown as Blob);
                const { data: uploaded } = await api.post<{ url: string }>(
                    '/upload/image?folder=profils',
                    form,
                    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 },
                );
                photoUrl = uploaded.url;
            }
            // 2. Enregistrer le tout
            await api.patch('/users/me', {
                prenom: prenom.trim() || undefined,
                nom: nom.trim() || undefined,
                telephone: telephone.trim() || undefined,
                // La localisation d'un artisan vit dans son profil pro (une
                // seule source) : on ne l'envoie jamais d'ici
                ...(isArtisan
                    ? {}
                    : {
                          ville: ville.trim() || undefined,
                          quartier: quartier.trim() || undefined,
                      }),
                photoUrl,
            });
        },
        onSuccess: async () => {
            await refreshUser().catch(() => undefined);
            Alert.alert('Profil complété 🎉', 'Vos informations sont enregistrées.', [
                { text: 'Parfait', onPress: onDone },
            ]);
        },
        onError: (e) =>
            Alert.alert(
                'Enregistrement impossible',
                e instanceof ApiError ? e.message : 'Réessayez.',
            ),
    });

    const next = () => {
        if (step === 1 && !prenom.trim()) {
            Alert.alert('Prénom requis', 'Indiquez au moins votre prénom.');
            return;
        }
        if (step === 2 && telephone.trim() && !isPhoneComplete(telephone)) {
            Alert.alert('Numéro incomplet', 'Terminez votre numéro ou passez cette étape.');
            return;
        }
        if (step < STEPS.length - 1) {
            setStep(step + 1);
        } else {
            save.mutate();
        }
    };

    const displayName = `${prenom} ${nom}`.trim() || user?.email || 'Vous';

    return (
        <>
            {/* En-tête + progression */}
            <View style={styles.topBar}>
                <Pressable
                    onPress={() => (step > 0 ? setStep(step - 1) : onBack())}
                    hitSlop={12}
                    style={styles.backButton}
                    accessibilityRole="button"
                    accessibilityLabel="Retour"
                >
                    <ArrowLeft size={20} color={colors.text} strokeWidth={2.2} />
                </Pressable>
                <View style={{ flex: 1 }}>
                    <Text style={styles.stepLabel}>
                        Étape {step + 1} sur {STEPS.length} · {STEPS[step]}
                    </Text>
                    <View style={styles.progressTrack}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${((step + 1) / STEPS.length) * 100}%` },
                            ]}
                        />
                    </View>
                </View>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {step === 0 && (
                        <View style={styles.centered}>
                            <Text style={styles.title}>Votre photo</Text>
                            <Text style={styles.subtitle}>
                                Un visage inspire confiance : les profils avec photo reçoivent plus
                                de réponses.
                            </Text>
                            <Pressable
                                onPress={() => void pickPhoto(false)}
                                accessibilityRole="button"
                                accessibilityLabel="Choisir une photo"
                            >
                                <Avatar name={displayName} uri={photoUri ?? user?.photoUrl} size={128} />
                                <View style={styles.cameraBadge}>
                                    <Camera size={16} color="#FFFFFF" strokeWidth={2.2} />
                                </View>
                            </Pressable>
                            <View style={styles.photoActions}>
                                <Button
                                    title="Galerie"
                                    variant="secondary"
                                    onPress={() => void pickPhoto(false)}
                                    style={{ flex: 1 }}
                                />
                                <Button
                                    title="Caméra"
                                    variant="secondary"
                                    onPress={() => void pickPhoto(true)}
                                    style={{ flex: 1 }}
                                />
                            </View>
                        </View>
                    )}

                    {step === 1 && (
                        <View style={{ gap: spacing.xl }}>
                            <Text style={styles.title}>Qui êtes-vous ?</Text>
                            <Input
                                label="Prénom *"
                                placeholder="Votre prénom"
                                value={prenom}
                                onChangeText={setPrenom}
                                autoComplete="given-name"
                                leftIcon={
                                    <UserIcon
                                        size={17}
                                        color={colors.textSecondary}
                                        strokeWidth={2}
                                    />
                                }
                            />
                            <Input
                                label="Nom"
                                placeholder="VOTRE NOM DE FAMILLE"
                                value={nom}
                                onChangeText={(v) => setNom(v.toUpperCase())}
                                autoCapitalize="characters"
                                autoComplete="family-name"
                                helper="En majuscules, comme sur vos documents officiels"
                                leftIcon={
                                    <UserIcon
                                        size={17}
                                        color={colors.textSecondary}
                                        strokeWidth={2}
                                    />
                                }
                            />
                        </View>
                    )}

                    {step === 2 && (
                        <View style={{ gap: spacing.xl }}>
                            <Text style={styles.title}>Votre téléphone</Text>
                            <Text style={styles.subtitle}>
                                L'artisan vous appelle sur ce numéro le jour de l'intervention.
                            </Text>
                            <PhoneInput
                                label="Numéro de téléphone"
                                value={telephone}
                                onChangeValue={setTelephone}
                            />
                        </View>
                    )}

                    {step === 3 && (
                        <View style={{ gap: spacing.xl }}>
                            <Text style={styles.title}>Où habitez-vous ?</Text>
                            <Text style={styles.subtitle}>
                                Pour vous proposer les artisans les plus proches.
                            </Text>
                            <Pressable
                                onPress={() => void useMyLocation()}
                                style={styles.locateButton}
                                accessibilityRole="button"
                            >
                                <LocateFixed size={16} color={colors.primary} strokeWidth={2} />
                                <Text style={styles.locateText}>
                                    {locating
                                        ? 'Localisation…'
                                        : 'Remplir automatiquement avec ma position'}
                                </Text>
                            </Pressable>
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
                        </View>
                    )}
                </ScrollView>

                {/* Pied : Passer / Continuer */}
                <View style={styles.footer}>
                    {step < STEPS.length - 1 && step !== 1 && (
                        <Button
                            title="Passer"
                            variant="ghost"
                            onPress={() => setStep(step + 1)}
                            style={{ flex: 1 }}
                        />
                    )}
                    <Button
                        title={step === STEPS.length - 1 ? 'Enregistrer' : 'Continuer'}
                        size="lg"
                        loading={save.isPending}
                        onPress={next}
                        style={{ flex: 2 }}
                    />
                </View>
            </KeyboardAvoidingView>
        </>
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
    stepLabel: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    progressTrack: {
        height: 6,
        borderRadius: radii.full,
        backgroundColor: colors.border,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: radii.full,
        backgroundColor: colors.primary,
    },
    content: {
        paddingHorizontal: spacing['2xl'],
        paddingTop: spacing.xl,
        paddingBottom: spacing.xl,
        flexGrow: 1,
    },
    centered: {
        alignItems: 'center',
        gap: spacing.xl,
    },
    title: {
        fontFamily: typography.heading,
        fontSize: fontSizes.xl,
        lineHeight: lineHeights.xl,
        color: colors.text,
        letterSpacing: -0.3,
    },
    subtitle: {
        fontFamily: typography.body,
        fontSize: fontSizes.base,
        lineHeight: lineHeights.base,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: -spacing.md,
    },
    cameraBadge: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        width: 36,
        height: 36,
        borderRadius: radii.full,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: colors.background,
    },
    photoActions: {
        flexDirection: 'row',
        gap: spacing.md,
        alignSelf: 'stretch',
    },
    locateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        height: 44,
        borderRadius: radii.md,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
    },
    locateText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.primary,
    },
    footer: {
        flexDirection: 'row',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
});
