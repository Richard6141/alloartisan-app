import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    KeyboardAvoidingView,
    Switch,
    Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Hammer, HardHat, Check } from 'lucide-react-native';
import { Button, Input } from '../components/ui';
import { useCategories } from '../features/catalog/hooks';
import {
    useMonProfilTravailleur,
    useUpsertProfilTravailleur,
} from '../features/travailleurs/hooks';
import { resolveCoords } from '../lib/geo';
import { ApiError } from '../lib/api';
import { colors, palette, spacing, typography, fontSizes, radii } from '../theme/tokens';

type Type = 'OUVRIER' | 'AIDE';
type Dispo = 'PONCTUEL' | 'REGULIER';

export default function ProfilTravailleurScreen() {
    const router = useRouter();
    const { data: existant } = useMonProfilTravailleur();
    const { data: categories } = useCategories();
    const upsert = useUpsertProfilTravailleur();

    const [type, setType] = useState<Type>('OUVRIER');
    const [polyvalent, setPolyvalent] = useState(false);
    const [metierIds, setMetierIds] = useState<string[]>([]);
    const [ville, setVille] = useState('');
    const [tarif, setTarif] = useState('');
    const [dispo, setDispo] = useState<Dispo>('PONCTUEL');
    const [dispoNow, setDispoNow] = useState(false);
    const [description, setDescription] = useState('');
    const [actif, setActif] = useState(true);
    const [loading, setLoading] = useState(false);

    // Pré-remplir si un profil existe déjà
    useEffect(() => {
        if (!existant) return;
        setType(existant.type);
        setPolyvalent(existant.polyvalent);
        setMetierIds((existant.metiers ?? []).map((m) => m.metierId));
        setVille(existant.villePrincipale);
        setTarif(existant.tarifJournalier ? String(existant.tarifJournalier) : '');
        setDispo(existant.disponibilite);
        setDispoNow(existant.disponibleMaintenant);
        setDescription(existant.description ?? '');
        setActif(existant.actif);
    }, [existant]);

    const metiers = useMemo(
        () => (categories ?? []).flatMap((c) => c.metiers ?? []),
        [categories],
    );

    const toggleMetier = (id: string) => {
        setMetierIds((prev) => {
            if (prev.includes(id)) return prev.filter((m) => m !== id);
            if (prev.length >= 2) {
                Alert.alert('Maximum 2', 'Vous pouvez choisir au plus 2 métiers/domaines.');
                return prev;
            }
            return [...prev, id];
        });
    };

    const submit = async () => {
        if (!ville.trim()) {
            Alert.alert('Ville requise', 'Indiquez votre ville principale.');
            return;
        }
        if (!polyvalent && metierIds.length === 0) {
            Alert.alert(
                'Métier requis',
                type === 'OUVRIER'
                    ? 'Choisissez au moins un métier que vous maîtrisez.'
                    : 'Choisissez un domaine, ou activez « Polyvalent ».',
            );
            return;
        }
        setLoading(true);
        try {
            const coords = await resolveCoords();
            if (!coords) {
                setLoading(false);
                Alert.alert('Position requise', 'Autorisez la localisation pour être trouvé près des chantiers.');
                return;
            }
            await upsert.mutateAsync({
                type,
                polyvalent: type === 'AIDE' ? polyvalent : false,
                villePrincipale: ville.trim(),
                latitude: coords.latitude,
                longitude: coords.longitude,
                disponibilite: dispo,
                disponibleMaintenant: dispoNow,
                tarifJournalier: tarif ? Number(tarif) : undefined,
                description: description.trim() || undefined,
                actif,
                metiers: polyvalent
                    ? []
                    : metierIds.map((id, i) => ({ metierId: id, estPrincipal: i === 0 })),
            });
            setLoading(false);
            Alert.alert('Profil enregistré ✅', 'Vous êtes visible des patrons qui cherchent de la main-d’œuvre.');
            router.back();
        } catch (e) {
            setLoading(false);
            Alert.alert('Enregistrement impossible', e instanceof ApiError ? e.message : 'Réessayez.');
        }
    };

    const showMetiers = !(type === 'AIDE' && polyvalent);

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
                    <ArrowLeft size={22} color={colors.text} strokeWidth={2} />
                </Pressable>
                <Text style={styles.headerTitle}>Disponible pour du travail</Text>
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.intro}>
                        Rendez-vous visible des patrons (artisans) qui ont besoin de renfort sur
                        les chantiers, ponctuellement ou régulièrement.
                    </Text>

                    {/* Type */}
                    <Text style={styles.label}>Je suis…</Text>
                    <View style={styles.segment}>
                        {(
                            [
                                { v: 'OUVRIER', t: 'Ouvrier', s: 'Je connais le métier', Icon: Hammer },
                                { v: 'AIDE', t: 'Aide / manœuvre', s: 'Force de travail', Icon: HardHat },
                            ] as const
                        ).map(({ v, t, s, Icon }) => {
                            const sel = type === v;
                            return (
                                <Pressable
                                    key={v}
                                    onPress={() => setType(v)}
                                    style={[styles.segCard, sel && styles.segCardSel]}
                                >
                                    <Icon
                                        size={20}
                                        color={sel ? colors.primary : colors.textSecondary}
                                        strokeWidth={2}
                                    />
                                    <Text style={[styles.segTitle, sel && { color: colors.primary }]}>
                                        {t}
                                    </Text>
                                    <Text style={styles.segSub}>{s}</Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    {/* Polyvalent (aide) */}
                    {type === 'AIDE' && (
                        <View style={styles.switchRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.switchLabel}>Polyvalent · tous chantiers</Text>
                                <Text style={styles.switchHint}>Sans métier précis</Text>
                            </View>
                            <Switch value={polyvalent} onValueChange={setPolyvalent} />
                        </View>
                    )}

                    {/* Métiers/domaines */}
                    {showMetiers && (
                        <>
                            <Text style={styles.label}>
                                {type === 'OUVRIER' ? 'Métier(s) maîtrisé(s)' : 'Domaine(s)'} · max 2
                            </Text>
                            <View style={styles.chips}>
                                {metiers.map((m) => {
                                    const sel = metierIds.includes(m.id);
                                    return (
                                        <Pressable
                                            key={m.id}
                                            onPress={() => toggleMetier(m.id)}
                                            style={[styles.chip, sel && styles.chipSel]}
                                        >
                                            {sel && (
                                                <Check size={13} color={palette.white} strokeWidth={2.6} />
                                            )}
                                            <Text style={[styles.chipTxt, sel && { color: palette.white }]}>
                                                {m.nom}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </>
                    )}

                    {/* Ville */}
                    <Input label="Ville principale" placeholder="Cotonou, Calavi…" value={ville} onChangeText={setVille} />

                    {/* Disponibilité */}
                    <Text style={styles.label}>Disponibilité</Text>
                    <View style={styles.segment}>
                        {(
                            [
                                { v: 'PONCTUEL', t: 'Ponctuel', s: 'À la journée' },
                                { v: 'REGULIER', t: 'Régulier', s: 'Cherche du stable' },
                            ] as const
                        ).map(({ v, t, s }) => {
                            const sel = dispo === v;
                            return (
                                <Pressable
                                    key={v}
                                    onPress={() => setDispo(v)}
                                    style={[styles.segCard, sel && styles.segCardSel]}
                                >
                                    <Text style={[styles.segTitle, sel && { color: colors.primary }]}>{t}</Text>
                                    <Text style={styles.segSub}>{s}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                    <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Disponible maintenant</Text>
                        <Switch value={dispoNow} onValueChange={setDispoNow} />
                    </View>

                    {/* Tarif */}
                    <Input
                        label="Tarif journalier indicatif (FCFA) · optionnel"
                        placeholder="3000"
                        keyboardType="number-pad"
                        value={tarif}
                        onChangeText={(v) => setTarif(v.replace(/\D/g, ''))}
                    />

                    {/* Description */}
                    <Input
                        label="Ce que je sais faire · optionnel"
                        placeholder="Ex. maçonnerie, coffrage, aide au ferraillage…"
                        value={description}
                        onChangeText={setDescription}
                        multiline
                    />

                    {/* Visible */}
                    <View style={styles.switchRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.switchLabel}>Rendre mon profil visible</Text>
                            <Text style={styles.switchHint}>Apparaître dans les recherches des patrons</Text>
                        </View>
                        <Switch value={actif} onValueChange={setActif} />
                    </View>

                    <Button
                        title={existant ? 'Enregistrer' : 'Activer mon profil'}
                        size="lg"
                        fullWidth
                        loading={loading}
                        onPress={submit}
                        style={{ marginTop: spacing.xl }}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
    },
    back: { padding: 2 },
    headerTitle: { fontFamily: typography.heading, fontSize: fontSizes.xl, color: colors.text },
    content: { paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'], gap: spacing.md },
    intro: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
    },
    label: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.text,
        marginTop: spacing.sm,
    },
    segment: { flexDirection: 'row', gap: spacing.md },
    segCard: {
        flex: 1,
        alignItems: 'center',
        gap: 3,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        borderRadius: radii.lg,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    segCardSel: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    segTitle: { fontFamily: typography.bodySemiBold, fontSize: fontSizes.sm, color: colors.text },
    segSub: { fontFamily: typography.body, fontSize: fontSizes.xs, color: colors.textSecondary },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
    },
    switchLabel: { fontFamily: typography.bodySemiBold, fontSize: fontSizes.sm, color: colors.text },
    switchHint: { fontFamily: typography.body, fontSize: fontSizes.xs, color: colors.textSecondary },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 7,
        paddingHorizontal: spacing.md,
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    chipSel: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipTxt: { fontFamily: typography.bodyMedium, fontSize: fontSizes.xs, color: colors.text },
});
