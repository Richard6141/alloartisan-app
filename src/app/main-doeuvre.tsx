import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { ArrowLeft, MapPinOff, Users, Megaphone, Plus } from 'lucide-react-native';
import { EmptyState, Spinner } from '../components/ui';
import { LoginInvite } from '../components/LoginInvite';
import { TravailleurCard } from '../features/travailleurs/TravailleurCard';
import { useSearchTravailleurs, type SearchTravailleurFilters } from '../features/travailleurs/hooks';
import { useAuth } from '../stores/auth';
import { resolveCoords } from '../lib/geo';
import { colors, palette, spacing, typography, fontSizes, radii } from '../theme/tokens';

type Filtre = 'TOUS' | 'OUVRIER' | 'AIDE';

const FILTRES: { v: Filtre; t: string }[] = [
    { v: 'TOUS', t: 'Tous' },
    { v: 'OUVRIER', t: 'Ouvriers' },
    { v: 'AIDE', t: 'Aides' },
];

export default function MainDoeuvreScreen() {
    const router = useRouter();
    const isAuth = useAuth((s) => s.status === 'authenticated');

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* En-tête */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
                    <ArrowLeft size={22} color={colors.text} strokeWidth={2} />
                </Pressable>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Main-d'œuvre</Text>
                    <Text style={styles.subtitle}>Ouvriers & aides autour de vous</Text>
                </View>
                {isAuth && (
                    <Pressable
                        style={styles.mesAnnonces}
                        onPress={() => router.push('/mes-annonces')}
                        accessibilityRole="button"
                        accessibilityLabel="Mes annonces"
                    >
                        <Megaphone size={15} color={colors.primary} strokeWidth={2} />
                        <Text style={styles.mesAnnoncesTxt}>Mes annonces</Text>
                    </Pressable>
                )}
            </View>

            {!isAuth ? (
                <LoginInvite
                    title="Trouver de la main-d'œuvre"
                    message="Connectez-vous pour chercher des ouvriers, des aides et publier vos annonces de chantier."
                />
            ) : (
                <MainDoeuvreContent />
            )}
        </SafeAreaView>
    );
}

function MainDoeuvreContent() {
    const router = useRouter();
    const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
    const [denied, setDenied] = useState(false);
    const [filtre, setFiltre] = useState<Filtre>('TOUS');

    useEffect(() => {
        void (async () => {
            const coords = await resolveCoords();
            if (coords) setPosition(coords);
            else setDenied(true);
        })();
    }, []);

    const filters: SearchTravailleurFilters = filtre === 'TOUS' ? {} : { type: filtre };
    const { data, isLoading } = useSearchTravailleurs(position, 25, filters);

    return (
        <>
            {/* Action principale : publier une annonce de chantier */}
            <Pressable
                style={({ pressed }) => [styles.publier, pressed && { opacity: 0.9 }]}
                onPress={() => router.push('/publier-annonce')}
                accessibilityRole="button"
                accessibilityLabel="Publier une annonce"
            >
                <Plus size={17} color={palette.white} strokeWidth={2.4} />
                <Text style={styles.publierTxt}>Publier une annonce</Text>
            </Pressable>

            {/* Accès rapides : mes annonces + mes engagements */}
            <View style={styles.quickRow}>
                <Pressable style={styles.quickLink} onPress={() => router.push('/mes-annonces')}>
                    <Text style={styles.quickTxt}>Mes annonces</Text>
                </Pressable>
                <Pressable style={styles.quickLink} onPress={() => router.push('/engagements')}>
                    <Text style={styles.quickTxt}>Mes engagements</Text>
                </Pressable>
            </View>

            {/* Filtres */}
            <View style={styles.segment}>
                {FILTRES.map(({ v, t }) => {
                    const sel = filtre === v;
                    return (
                        <Pressable
                            key={v}
                            onPress={() => setFiltre(v)}
                            style={[styles.seg, sel && styles.segSel]}
                        >
                            <Text style={[styles.segTxt, sel && styles.segTxtSel]}>{t}</Text>
                        </Pressable>
                    );
                })}
            </View>

            {denied ? (
                <EmptyState
                    icon={<MapPinOff size={44} color={colors.textMuted} strokeWidth={1.5} />}
                    title="Localisation requise"
                    message="Autorisez la localisation pour trouver la main-d'œuvre proche des chantiers."
                />
            ) : !position || isLoading ? (
                <View style={styles.loader}>
                    <Spinner color={colors.primary} size={30} />
                    <Text style={styles.loaderTxt}>
                        {!position ? 'Localisation en cours…' : 'Recherche autour de vous…'}
                    </Text>
                </View>
            ) : !data || data.length === 0 ? (
                <EmptyState
                    icon={<Users size={44} color={colors.textMuted} strokeWidth={1.5} />}
                    title="Personne pour le moment"
                    message="Aucun ouvrier ni aide disponible dans ce rayon. Réessayez plus tard."
                />
            ) : (
                <FlashList
                    data={data}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingTop: spacing.xs, paddingBottom: spacing['3xl'] }}
                    renderItem={({ item }) => (
                        <TravailleurCard
                            travailleur={item}
                            onPress={() =>
                                router.push({
                                    pathname: '/travailleur/[id]',
                                    params: { id: item.id },
                                })
                            }
                        />
                    )}
                />
            )}
        </>
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
    title: { fontFamily: typography.heading, fontSize: fontSizes.xl, color: colors.text },
    subtitle: { fontFamily: typography.body, fontSize: fontSizes.xs, color: colors.textSecondary },
    mesAnnonces: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 6,
        paddingHorizontal: spacing.sm + 2,
        borderRadius: radii.full,
        backgroundColor: colors.primarySoft,
    },
    mesAnnoncesTxt: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
        color: colors.primary,
    },
    publier: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        marginHorizontal: spacing.xl,
        marginBottom: spacing.md,
        height: 46,
        borderRadius: radii.lg,
        backgroundColor: colors.primary,
    },
    publierTxt: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.base,
        color: palette.white,
    },
    quickRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    quickLink: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing.sm + 2,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    quickTxt: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    segment: {
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.sm,
    },
    seg: {
        paddingVertical: 6,
        paddingHorizontal: spacing.md,
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    segSel: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    segTxt: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    segTxtSel: { color: colors.primary, fontFamily: typography.bodySemiBold },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
    loaderTxt: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
});
