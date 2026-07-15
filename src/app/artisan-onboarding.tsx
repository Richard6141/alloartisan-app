import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    Switch,
    Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, LocateFixed, BadgeCheck } from 'lucide-react-native';
import { LiveMap } from '../components/LiveMap';
import { api, ApiError } from '../lib/api';
import { resolvePosition } from '../lib/geo';
import { queryKeys } from '../lib/queryClient';
import { useAuth } from '../stores/auth';
import { Button, Input, Card } from '../components/ui';
import type { Metier } from '../types/api';
import { colors, spacing, typography, fontSizes, lineHeights, radii } from '../theme/tokens';

/**
 * Onboarding artisan — création du profil métier en une page :
 * métier principal, entreprise, tarif, ville, position GPS, options.
 * Sans ce profil, un compte ARTISAN ne peut pas recevoir de demandes.
 */
export default function ArtisanOnboardingScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const refreshUser = useAuth((s) => s.refreshUser);

    const { data: metiers } = useQuery({
        queryKey: queryKeys.metiers,
        queryFn: async () => {
            const { data } = await api.get<Metier[] | { data: Metier[] }>('/metiers');
            return Array.isArray(data) ? data : data.data;
        },
        staleTime: 24 * 60 * 60 * 1000,
    });

    const [metierId, setMetierId] = useState<string | null>(null);
    const [secondaires, setSecondaires] = useState<string[]>([]);
    const [nomEntreprise, setNomEntreprise] = useState('');
    const [ville, setVille] = useState('');
    const [villeAuto, setVilleAuto] = useState(false);
    const [bio, setBio] = useState('');
    const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [urgences, setUrgences] = useState(false);
    const [weekend, setWeekend] = useState(false);
    const [locating, setLocating] = useState(false);

    const useMyLocation = async () => {
        setLocating(true);
        const pos = await resolvePosition();
        setLocating(false);
        if (!pos) {
            Alert.alert(
                'Position requise',
                'Votre position sert à vous proposer les clients proches de chez vous.',
            );
            return;
        }
        setCoords({ latitude: pos.latitude, longitude: pos.longitude });
        // ANTI-FRAUDE : la ville découle de la position réelle et se verrouille.
        // Saisie manuelle possible uniquement si le géocodage ne renvoie rien.
        if (pos.ville) {
            setVille(pos.ville);
            setVilleAuto(true);
        }
    };

    const createProfile = useMutation({
        mutationFn: async () => {
            const { data } = await api.post('/artisans', {
                nomEntreprise: nomEntreprise.trim() || undefined,
                bio: bio.trim() || undefined,
                villePrincipale: ville.trim(),
                latitude: coords!.latitude,
                longitude: coords!.longitude,
                accepteUrgences: urgences,
                accepteWeekend: weekend,
                // PIVOT PROXIMITÉ : aucun tarif demandé, le prix se discute
                // directement entre client et artisan
                metiers: [
                    { metierId: metierId!, estPrincipal: true },
                    ...secondaires.map((id) => ({ metierId: id, estPrincipal: false })),
                ],
            });
            return data;
        },
        onSuccess: async () => {
            await refreshUser().catch(() => undefined);
            void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
            Alert.alert(
                'Profil créé 🎉',
                'Suivons ensemble les dernières étapes pour rendre votre profil visible des ' +
                    'clients : pièce d\'identité, diplôme, et vos réalisations.',
                [
                    {
                        text: 'Continuer',
                        onPress: () => router.replace('/artisan-demarrage'),
                    },
                ],
            );
        },
        onError: (e) =>
            Alert.alert(
                'Création impossible',
                e instanceof ApiError ? e.message : 'Réessayez plus tard.',
            ),
    });

    const submit = () => {
        if (!metierId) {
            Alert.alert('Métier requis', 'Sélectionnez votre métier principal.');
            return;
        }
        if (!ville.trim()) {
            Alert.alert('Ville requise', "Indiquez votre ville principale d'activité.");
            return;
        }
        if (!coords) {
            Alert.alert(
                'Position requise',
                'Touchez « Utiliser ma position ». Elle permet aux clients proches de vous trouver.',
            );
            return;
        }
        createProfile.mutate();
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
                <Text style={styles.title}>Mon profil artisan</Text>
                <View style={{ width: 38 }} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text style={styles.subtitle}>
                        Quelques informations et vous pourrez recevoir vos premières demandes.
                    </Text>

                    {/* Métier principal */}
                    <View>
                        <Text style={styles.fieldLabel}>Votre métier principal *</Text>
                        <Text style={styles.fieldHelper}>
                            Celui pour lequel vous fournirez un justificatif (diplôme,
                            attestation…) après cette étape.
                        </Text>
                        <View style={styles.metierWrap}>
                            {(metiers ?? []).map((m) => {
                                const selected = metierId === m.id;
                                return (
                                    <Pressable
                                        key={m.id}
                                        onPress={() => {
                                            setMetierId(m.id);
                                            // Un métier ne peut pas être principal ET secondaire
                                            setSecondaires((prev) =>
                                                prev.filter((id) => id !== m.id),
                                            );
                                        }}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected }}
                                        style={[styles.metierChip, selected && styles.metierChipOn]}
                                    >
                                        <Text
                                            style={[
                                                styles.metierChipText,
                                                selected && { color: colors.onPrimary },
                                            ]}
                                        >
                                            {m.nom}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                    {/* Métiers secondaires */}
                    {metierId != null && (
                        <View>
                            <Text style={styles.fieldLabel}>
                                Métiers secondaires (optionnel, 2 max)
                            </Text>
                            <Text style={styles.fieldHelper}>
                                Vos autres savoir-faire : ils seront examinés par notre équipe.
                            </Text>
                            <View style={styles.metierWrap}>
                                {(metiers ?? [])
                                    .filter((m) => m.id !== metierId)
                                    .map((m) => {
                                        const selected = secondaires.includes(m.id);
                                        return (
                                            <Pressable
                                                key={m.id}
                                                onPress={() =>
                                                    setSecondaires((prev) => {
                                                        if (prev.includes(m.id)) {
                                                            return prev.filter((id) => id !== m.id);
                                                        }
                                                        if (prev.length >= 2) {
                                                            Alert.alert(
                                                                'Deux métiers secondaires maximum',
                                                                'Retirez-en un pour en choisir un autre.',
                                                            );
                                                            return prev;
                                                        }
                                                        return [...prev, m.id];
                                                    })
                                                }
                                                accessibilityRole="checkbox"
                                                accessibilityState={{ checked: selected }}
                                                style={[
                                                    styles.metierChip,
                                                    selected && styles.metierChipOn,
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.metierChipText,
                                                        selected && { color: colors.onPrimary },
                                                    ]}
                                                >
                                                    {m.nom}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                            </View>
                        </View>
                    )}

                    <Input
                        label="Nom de votre entreprise (optionnel)"
                        placeholder="Ex. : Plomberie Express Cotonou"
                        value={nomEntreprise}
                        onChangeText={setNomEntreprise}
                        maxLength={200}
                    />

                    <View>
                        <Input
                            label="Ville principale *"
                            placeholder="Touchez « Utiliser ma position »"
                            value={ville}
                            onChangeText={setVille}
                            editable={!villeAuto}
                            helper={
                                villeAuto
                                    ? 'Déterminée par votre position réelle, gage de confiance pour les clients'
                                    : undefined
                            }
                        />
                        <Pressable
                            onPress={useMyLocation}
                            style={styles.locateButton}
                            accessibilityRole="button"
                        >
                            <LocateFixed
                                size={15}
                                color={coords ? colors.success : colors.primary}
                                strokeWidth={2}
                            />
                            <Text
                                style={[
                                    styles.locateText,
                                    coords != null && { color: colors.success },
                                ]}
                            >
                                {locating
                                    ? 'Localisation…'
                                    : coords
                                      ? 'Position enregistrée ✓'
                                      : 'Utiliser ma position (requis) *'}
                            </Text>
                        </Pressable>
                        {/* Aperçu de la position récupérée sur la carte */}
                        {coords && (
                            <LiveMap
                                point={coords}
                                rounded
                                style={{ height: 150, marginTop: spacing.md }}
                            />
                        )}
                    </View>

                    <Input
                        label="Présentez-vous (optionnel)"
                        placeholder="Votre expérience, vos spécialités, ce qui vous distingue…"
                        value={bio}
                        onChangeText={setBio}
                        multiline
                        numberOfLines={4}
                        style={{ minHeight: 90, textAlignVertical: 'top' }}
                        maxLength={2000}
                    />

                    <Card style={styles.switchCard}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.switchTitle}>⚡ J'accepte les urgences</Text>
                            <Text style={styles.switchText}>
                                Interventions en moins d'une heure, plus de demandes
                            </Text>
                        </View>
                        <Switch
                            value={urgences}
                            onValueChange={setUrgences}
                            trackColor={{ true: colors.primary, false: colors.border }}
                            thumbColor={colors.surface}
                        />
                    </Card>
                    <Card style={styles.switchCard}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.switchTitle}>📅 Je travaille le week-end</Text>
                        </View>
                        <Switch
                            value={weekend}
                            onValueChange={setWeekend}
                            trackColor={{ true: colors.primary, false: colors.border }}
                            thumbColor={colors.surface}
                        />
                    </Card>

                    <Button
                        title="Créer mon profil"
                        size="lg"
                        fullWidth
                        loading={createProfile.isPending}
                        onPress={submit}
                    />

                    <View style={styles.verifyNote}>
                        <BadgeCheck size={15} color={colors.primary} strokeWidth={2} />
                        <Text style={styles.verifyNoteText}>
                            Votre profil sera vérifié par notre équipe avant d'être visible, gage
                            de confiance pour les clients.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
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
        gap: spacing.xl,
    },
    subtitle: {
        fontFamily: typography.body,
        fontSize: fontSizes.base,
        lineHeight: lineHeights.base,
        color: colors.textSecondary,
    },
    fieldLabel: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    fieldHelper: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 3,
        color: colors.textMuted,
        marginTop: -spacing.xs,
        marginBottom: spacing.sm,
    },
    metierWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    metierChip: {
        paddingHorizontal: spacing.md,
        height: 36,
        justifyContent: 'center',
        borderRadius: radii.full,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    metierChipOn: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    metierChipText: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
    locateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: spacing.sm,
        alignSelf: 'flex-start',
        paddingVertical: spacing.xs,
    },
    locateText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.primary,
    },
    switchCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    switchTitle: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.base,
        color: colors.text,
    },
    switchText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    verifyNote: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
    },
    verifyNoteText: {
        flex: 1,
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 3,
        color: colors.textMuted,
    },
});
