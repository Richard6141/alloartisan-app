import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { ArrowLeft, MapPinOff, Megaphone, MapPin, Hammer, HardHat, Check } from 'lucide-react-native';
import { EmptyState, Button, Spinner } from '../components/ui';
import { LoginInvite } from '../components/LoginInvite';
import { useAnnoncesAutour, useManifesterInteret } from '../features/travailleurs/annonces-hooks';
import { useMonProfilTravailleur } from '../features/travailleurs/hooks';
import { useAuth } from '../stores/auth';
import { resolveCoords } from '../lib/geo';
import { ApiError } from '../lib/api';
import type { AnnonceChantier } from '../types/api';
import { colors, palette, spacing, typography, fontSizes, radii } from '../theme/tokens';

type Filtre = 'TOUS' | 'OUVRIER' | 'AIDE';

const PERIODE_LABEL: Record<AnnonceChantier['periode'], string> = {
    UNE_JOURNEE: 'Une journée',
    PLUSIEURS_JOURS: 'Plusieurs jours',
    REGULIER: 'Régulier',
};

export default function AnnoncesChantierScreen() {
    const router = useRouter();
    const isAuth = useAuth((s) => s.status === 'authenticated');
    const { data: profil } = useMonProfilTravailleur(isAuth);
    const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
    const [denied, setDenied] = useState(false);
    const [filtre, setFiltre] = useState<Filtre>('TOUS');
    const [manifestes, setManifestes] = useState<Set<string>>(new Set());
    const manifester = useManifesterInteret();

    useEffect(() => {
        void (async () => {
            const coords = await resolveCoords();
            if (coords) setPosition(coords);
            else setDenied(true);
        })();
    }, []);

    const { data, isLoading } = useAnnoncesAutour(
        position,
        25,
        filtre === 'TOUS' ? undefined : filtre,
    );

    const onManifester = (annonce: AnnonceChantier) => {
        if (!profil) {
            Alert.alert(
                'Profil requis',
                'Activez d’abord votre profil « disponible pour du travail » pour vous manifester.',
                [
                    { text: 'Plus tard', style: 'cancel' },
                    { text: 'Activer', onPress: () => router.push('/profil-travailleur') },
                ],
            );
            return;
        }
        Alert.alert(
            'Se manifester',
            `Prévenir le patron que vous êtes disponible pour ce chantier à ${annonce.ville} ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Je suis intéressé',
                    onPress: async () => {
                        try {
                            await manifester.mutateAsync({ annonceId: annonce.id });
                            setManifestes((prev) => new Set(prev).add(annonce.id));
                            Alert.alert('Envoyé ✅', 'Le patron a été prévenu de votre intérêt.');
                        } catch (e) {
                            Alert.alert(
                                'Impossible',
                                e instanceof ApiError ? e.message : 'Réessayez.',
                            );
                        }
                    },
                },
            ],
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={12}>
                    <ArrowLeft size={22} color={colors.text} strokeWidth={2} />
                </Pressable>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Annonces de chantier</Text>
                    <Text style={styles.subtitle}>Des patrons cherchent du renfort près de vous</Text>
                </View>
            </View>

            {!isAuth ? (
                <LoginInvite
                    title="Annonces de chantier"
                    message="Connectez-vous pour voir les chantiers près de vous et vous manifester."
                />
            ) : (
              <>
            <View style={styles.segment}>
                {(
                    [
                        { v: 'TOUS', t: 'Toutes' },
                        { v: 'OUVRIER', t: 'Ouvrier' },
                        { v: 'AIDE', t: 'Aide' },
                    ] as const
                ).map(({ v, t }) => {
                    const sel = filtre === v;
                    return (
                        <Pressable
                            key={v}
                            onPress={() => setFiltre(v)}
                            style={[styles.seg, sel && styles.segSel]}
                        >
                            <Text style={[styles.segTxt, sel && { color: palette.white }]}>{t}</Text>
                        </Pressable>
                    );
                })}
            </View>

            {denied ? (
                <EmptyState
                    icon={<MapPinOff size={44} color={colors.textMuted} strokeWidth={1.5} />}
                    title="Localisation requise"
                    message="Autorisez la localisation pour voir les chantiers proches de vous."
                />
            ) : !position || isLoading ? (
                <View style={styles.loader}>
                    <Spinner color={colors.primary} size={30} />
                </View>
            ) : !data || data.length === 0 ? (
                <EmptyState
                    icon={<Megaphone size={44} color={colors.textMuted} strokeWidth={1.5} />}
                    title="Aucune annonce"
                    message="Pas de chantier ouvert dans votre zone pour le moment. Revenez plus tard."
                />
            ) : (
                <FlashList
                    data={data}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{
                        paddingTop: spacing.md,
                        paddingBottom: spacing['3xl'],
                        paddingHorizontal: spacing.xl,
                    }}
                    renderItem={({ item }) => {
                        const Icon = item.type === 'OUVRIER' ? Hammer : HardHat;
                        const manifeste = manifestes.has(item.id);
                        const patronNom =
                            `${item.patron?.prenom ?? ''} ${item.patron?.nom ?? ''}`.trim() ||
                            'Un patron';
                        return (
                            <View style={styles.card}>
                                <View style={styles.cardHead}>
                                    <View style={styles.typeBadge}>
                                        <Icon size={14} color={colors.primary} strokeWidth={2} />
                                        <Text style={styles.typeTxt}>
                                            {item.type === 'OUVRIER' ? 'Ouvrier' : 'Aide'}
                                            {item.metier ? ` · ${item.metier.nom}` : ''}
                                        </Text>
                                    </View>
                                    {item.distanceKm != null && (
                                        <View style={styles.distance}>
                                            <MapPin size={12} color={colors.textSecondary} strokeWidth={2} />
                                            <Text style={styles.distanceTxt}>
                                                {item.distanceKm < 1
                                                    ? '< 1 km'
                                                    : `${Math.round(item.distanceKm)} km`}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                <Text style={styles.desc}>{item.description}</Text>

                                <View style={styles.metaRow}>
                                    <Text style={styles.meta}>📍 {item.ville}</Text>
                                    <Text style={styles.meta}>👥 {item.nombrePersonnes} pers.</Text>
                                    <Text style={styles.meta}>🗓 {PERIODE_LABEL[item.periode]}</Text>
                                </View>
                                {item.tarifJournalier ? (
                                    <Text style={styles.tarif}>
                                        {item.tarifJournalier.toLocaleString('fr-FR')} FCFA / jour
                                    </Text>
                                ) : null}

                                <Text style={styles.patron}>Publié par {patronNom}</Text>

                                {manifeste ? (
                                    <View style={styles.doneRow}>
                                        <Check size={16} color={colors.success} strokeWidth={2.4} />
                                        <Text style={styles.doneTxt}>Vous vous êtes manifesté</Text>
                                    </View>
                                ) : (
                                    <Button
                                        title="Ça m'intéresse"
                                        variant="secondary"
                                        fullWidth
                                        onPress={() => onManifester(item)}
                                        style={{ marginTop: spacing.md }}
                                    />
                                )}
                            </View>
                        );
                    }}
                />
            )}
              </>
            )}
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
    title: { fontFamily: typography.heading, fontSize: fontSizes.xl, color: colors.text },
    subtitle: { fontFamily: typography.body, fontSize: fontSizes.xs, color: colors.textSecondary },
    segment: {
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.md,
    },
    seg: {
        paddingVertical: 7,
        paddingHorizontal: spacing.lg,
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    segSel: { backgroundColor: colors.primary, borderColor: colors.primary },
    segTxt: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    card: {
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    cardHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: colors.primarySoft,
        paddingVertical: 4,
        paddingHorizontal: spacing.sm,
        borderRadius: radii.full,
    },
    typeTxt: { fontFamily: typography.bodySemiBold, fontSize: fontSizes.xs, color: colors.primary },
    distance: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    distanceTxt: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
    desc: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.text,
        lineHeight: 20,
    },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
    meta: { fontFamily: typography.bodyMedium, fontSize: fontSizes.xs, color: colors.textSecondary },
    tarif: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.primary,
        marginTop: spacing.xs,
    },
    patron: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        marginTop: spacing.sm,
    },
    doneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: spacing.md,
        paddingVertical: spacing.sm,
    },
    doneTxt: { fontFamily: typography.bodySemiBold, fontSize: fontSizes.sm, color: colors.success },
});
