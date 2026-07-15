import React, { useMemo, useState } from 'react';
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
import { ArrowLeft, Hammer, HardHat, Check } from 'lucide-react-native';
import { Button, Input } from '../components/ui';
import { useCategories } from '../features/catalog/hooks';
import { useCreerAnnonce } from '../features/travailleurs/annonces-hooks';
import { resolveCoords } from '../lib/geo';
import { ApiError } from '../lib/api';
import { colors, palette, spacing, typography, fontSizes, radii } from '../theme/tokens';

type Type = 'OUVRIER' | 'AIDE';
type Periode = 'UNE_JOURNEE' | 'PLUSIEURS_JOURS' | 'REGULIER';

export default function PublierAnnonceScreen() {
    const router = useRouter();
    const { data: categories } = useCategories();
    const creer = useCreerAnnonce();

    const [type, setType] = useState<Type>('OUVRIER');
    const [metierId, setMetierId] = useState<string | null>(null);
    const [nombre, setNombre] = useState('1');
    const [ville, setVille] = useState('');
    const [periode, setPeriode] = useState<Periode>('UNE_JOURNEE');
    const [tarif, setTarif] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    const metiers = useMemo(
        () => (categories ?? []).flatMap((c) => c.metiers ?? []),
        [categories],
    );

    const submit = async () => {
        if (!ville.trim()) {
            Alert.alert('Ville requise', 'Indiquez la ville du chantier.');
            return;
        }
        if (!description.trim()) {
            Alert.alert('Description requise', 'Décrivez brièvement le besoin.');
            return;
        }
        setLoading(true);
        try {
            const coords = await resolveCoords();
            if (!coords) {
                setLoading(false);
                Alert.alert('Position requise', 'Autorisez la localisation pour cibler la main-d’œuvre proche.');
                return;
            }
            await creer.mutateAsync({
                type,
                metierId: metierId ?? undefined,
                nombrePersonnes: Math.max(1, Number(nombre) || 1),
                latitude: coords.latitude,
                longitude: coords.longitude,
                ville: ville.trim(),
                periode,
                tarifJournalier: tarif ? Number(tarif) : undefined,
                description: description.trim(),
            });
            setLoading(false);
            Alert.alert(
                'Annonce publiée ✅',
                'Les ouvriers et aides de la zone viennent d’être prévenus. Les personnes intéressées apparaîtront dans « Mes annonces ».',
            );
            router.replace('/mes-annonces');
        } catch (e) {
            setLoading(false);
            Alert.alert('Publication impossible', e instanceof ApiError ? e.message : 'Réessayez.');
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
                    <ArrowLeft size={22} color={colors.text} strokeWidth={2} />
                </Pressable>
                <Text style={styles.headerTitle}>Publier une annonce</Text>
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.intro}>
                        Décrivez votre besoin de renfort. Les ouvriers et aides disponibles dans la
                        zone seront notifiés et pourront se manifester.
                    </Text>

                    {/* Type recherché */}
                    <Text style={styles.label}>Je recherche…</Text>
                    <View style={styles.segment}>
                        {(
                            [
                                { v: 'OUVRIER', t: 'Ouvrier', s: 'Connaît le métier', Icon: Hammer },
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

                    {/* Métier (optionnel) */}
                    <Text style={styles.label}>Métier ciblé · optionnel</Text>
                    <Text style={styles.hint}>
                        Laissez vide pour être ouvert à tous. Sinon, seuls les travailleurs de ce
                        métier (ou polyvalents) seront notifiés.
                    </Text>
                    <View style={styles.chips}>
                        {metiers.map((m) => {
                            const sel = metierId === m.id;
                            return (
                                <Pressable
                                    key={m.id}
                                    onPress={() => setMetierId(sel ? null : m.id)}
                                    style={[styles.chip, sel && styles.chipSel]}
                                >
                                    {sel && <Check size={13} color={palette.white} strokeWidth={2.6} />}
                                    <Text style={[styles.chipTxt, sel && { color: palette.white }]}>
                                        {m.nom}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    {/* Nombre de personnes */}
                    <Input
                        label="Nombre de personnes"
                        placeholder="1"
                        keyboardType="number-pad"
                        value={nombre}
                        onChangeText={(v) => setNombre(v.replace(/\D/g, ''))}
                    />

                    {/* Ville */}
                    <Input
                        label="Ville / lieu du chantier"
                        placeholder="Cotonou, Calavi…"
                        value={ville}
                        onChangeText={setVille}
                    />

                    {/* Période */}
                    <Text style={styles.label}>Durée</Text>
                    <View style={styles.segment}>
                        {(
                            [
                                { v: 'UNE_JOURNEE', t: 'Une journée' },
                                { v: 'PLUSIEURS_JOURS', t: 'Plusieurs jours' },
                                { v: 'REGULIER', t: 'Régulier' },
                            ] as const
                        ).map(({ v, t }) => {
                            const sel = periode === v;
                            return (
                                <Pressable
                                    key={v}
                                    onPress={() => setPeriode(v)}
                                    style={[styles.segSmall, sel && styles.segCardSel]}
                                >
                                    <Text style={[styles.segSmallTxt, sel && { color: colors.primary }]}>
                                        {t}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    {/* Tarif */}
                    <Input
                        label="Tarif journalier proposé (FCFA) · optionnel"
                        placeholder="3000"
                        keyboardType="number-pad"
                        value={tarif}
                        onChangeText={(v) => setTarif(v.replace(/\D/g, ''))}
                    />

                    {/* Description */}
                    <Input
                        label="Description du besoin"
                        placeholder="Ex. coulage de dalle, besoin de 2 manœuvres pour la journée…"
                        value={description}
                        onChangeText={setDescription}
                        multiline
                    />

                    <Button
                        title="Publier l'annonce"
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
    hint: { fontFamily: typography.body, fontSize: fontSizes.xs, color: colors.textSecondary },
    segment: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
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
    segSmall: {
        paddingVertical: 9,
        paddingHorizontal: spacing.md,
        borderRadius: radii.lg,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    segSmallTxt: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
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
