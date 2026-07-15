import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { LocateFixed, MapPinOff, Search, SearchX, XCircle } from 'lucide-react-native';
import {
    useArtisanSearch,
    useCategories,
    useNearbyArtisans,
    useAutocomplete,
    usePositionApprox,
} from '../../features/catalog/hooks';
import { ArtisanCard } from '../../features/catalog/ArtisanCard';
import { resolvePosition } from '../../lib/geo';
import { LiveMap } from '../../components/LiveMap';
import { Skeleton, EmptyState } from '../../components/ui';
import type { ArtisanSummary } from '../../types/api';
import { colors, spacing, typography, fontSizes, radii, shadows } from '../../theme/tokens';

/** Rayons de la recherche progressive : on élargit tant qu'il y a peu de résultats */
const RAYONS_KM = [5, 10, 20, 50];

/** Anti-rebond : on n'interroge l'API que 350 ms après la dernière frappe */
function useDebounced<T>(value: T, delay = 350): T {
    const [debounced, setDebounced] = useState(value);
    React.useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

export default function RechercheScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        categorie?: string;
        urgence?: string;
        q?: string;
        autour?: string;
    }>();
    const { data: categories } = useCategories();

    const [query, setQuery] = useState('');
    const [selectedCat, setSelectedCat] = useState<string | undefined>(params.categorie);
    const [urgence, setUrgence] = useState(params.urgence === '1');
    const debouncedQuery = useDebounced(query);
    const inputRef = useRef<TextInput>(null);

    // Mode « Autour de moi » : position réelle + rayon progressif
    const [autourDeMoi, setAutourDeMoi] = useState(false);
    const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
    const [rayon, setRayon] = useState(RAYONS_KM[0]);
    const [rayonAuto, setRayonAuto] = useState(true);
    const [locating, setLocating] = useState(false);
    // Vue carte : artisans positionnés, tap sur un marqueur = mini-fiche
    const [vueCarte, setVueCarte] = useState(false);
    const [selectionCarte, setSelectionCarte] = useState<ArtisanSummary | null>(null);

    // Curseur prêt à taper dès qu'on arrive sur l'onglet Recherche
    useFocusEffect(
        useCallback(() => {
            const t = setTimeout(() => inputRef.current?.focus(), 250);
            return () => clearTimeout(t);
        }, []),
    );

    // L'onglet reste monté : quand on arrive depuis l'accueil avec une
    // catégorie ou le mode urgence, appliquer le filtre à CHAQUE navigation
    React.useEffect(() => {
        if (params.categorie) setSelectedCat(params.categorie);
    }, [params.categorie]);
    React.useEffect(() => {
        if (params.urgence === '1') setUrgence(true);
    }, [params.urgence]);
    // « Fuite d'eau », « Panne de courant »… depuis l'accueil : recherche préremplie
    React.useEffect(() => {
        if (params.q) setQuery(params.q);
    }, [params.q]);
    // « Autour de moi » depuis l'accueil : active directement le mode proximité
    React.useEffect(() => {
        if (params.autour === '1' && !autourDeMoi && !locating) {
            void toggleAutourDeMoi();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.autour]);

    // Position silencieuse : les résultats classiques portent aussi la distance
    const positionApprox = usePositionApprox();

    const searchParams = useMemo(
        () => ({
            q: debouncedQuery || undefined,
            categorieSlug: selectedCat,
            urgence: urgence || undefined,
            latitude: positionApprox?.latitude,
            longitude: positionApprox?.longitude,
            limit: 20,
        }),
        [debouncedQuery, selectedCat, urgence, positionApprox],
    );

    const hasFilters = !!query || !!selectedCat || urgence || autourDeMoi;

    /** Tout remettre à zéro, y compris les filtres arrivés depuis l'accueil */
    const resetAll = () => {
        setQuery('');
        setSelectedCat(undefined);
        setUrgence(false);
        setAutourDeMoi(false);
        setVueCarte(false);
        setSelectionCarte(null);
        router.setParams({
            categorie: undefined,
            urgence: undefined,
            q: undefined,
            autour: undefined,
        });
    };

    /** Active/désactive « Autour de moi » (capture la position réelle) */
    const toggleAutourDeMoi = async () => {
        if (autourDeMoi) {
            setAutourDeMoi(false);
            return;
        }
        setLocating(true);
        const pos = await resolvePosition();
        setLocating(false);
        if (!pos) {
            Alert.alert(
                'Position indisponible',
                'Autorisez la localisation pour voir les artisans autour de vous.',
            );
            return;
        }
        setPosition({ latitude: pos.latitude, longitude: pos.longitude });
        setRayon(RAYONS_KM[0]);
        setRayonAuto(true);
        setAutourDeMoi(true);
    };

    const { data, isLoading } = useArtisanSearch(searchParams, !autourDeMoi);
    const nearby = useNearbyArtisans(autourDeMoi ? position : null, rayon);
    const { data: suggestions } = useAutocomplete(autourDeMoi ? '' : debouncedQuery);

    // Recherche PROGRESSIVE : tant qu'il y a peu de résultats, le rayon
    // s'élargit tout seul (5 → 10 → 20 → 50 km), jusqu'au premier choix manuel
    React.useEffect(() => {
        if (!autourDeMoi || !rayonAuto || nearby.data == null) return;
        if (nearby.data.length >= 3) {
            setRayonAuto(false);
            return;
        }
        const suivant = RAYONS_KM.find((r) => r > rayon);
        if (suivant) setRayon(suivant);
        else setRayonAuto(false);
    }, [autourDeMoi, rayonAuto, nearby.data, rayon]);

    // En mode proximité, la recherche filtre LOCALEMENT parmi les artisans
    // déjà chargés autour de soi (nom, métier, ville) — instantané.
    const filtreTexte = query.trim().toLowerCase();
    const artisans = useMemo(() => {
        const base = autourDeMoi ? (nearby.data ?? []) : (data?.items ?? []);
        if (!autourDeMoi || !filtreTexte) return base;
        return base.filter((a) => {
            const nom = (
                a.nomEntreprise ?? `${a.user?.prenom ?? ''} ${a.user?.nom ?? ''}`
            ).toLowerCase();
            const ville = (a.villePrincipale ?? '').toLowerCase();
            const metier =
                a.metierPrincipal?.nom?.toLowerCase() ??
                a.metiers?.find((m) => m.estPrincipal)?.metier.nom?.toLowerCase() ??
                '';
            return (
                nom.includes(filtreTexte) ||
                ville.includes(filtreTexte) ||
                metier.includes(filtreTexte)
            );
        });
    }, [autourDeMoi, nearby.data, data, filtreTexte]);

    const chargement = autourDeMoi ? nearby.isLoading || locating || rayonAuto : isLoading;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Barre de recherche — en mode proximité elle filtre les artisans proches */}
            <View style={styles.searchWrap}>
                <View style={styles.searchBar}>
                    <Search size={20} color={colors.textSecondary} strokeWidth={2} />
                    <TextInput
                        ref={inputRef}
                        style={styles.searchInput}
                        placeholder={
                            autourDeMoi
                                ? 'Filtrer parmi les artisans proches…'
                                : 'Métier, nom, quartier…'
                        }
                        placeholderTextColor={colors.textMuted}
                        value={query}
                        onChangeText={setQuery}
                        returnKeyType="search"
                        accessibilityLabel="Rechercher un artisan"
                    />
                    {query.length > 0 && (
                        <Pressable
                            onPress={() => setQuery('')}
                            hitSlop={10}
                            accessibilityRole="button"
                            accessibilityLabel="Effacer la recherche"
                        >
                            <XCircle size={18} color={colors.textMuted} strokeWidth={2} />
                        </Pressable>
                    )}
                </View>
            </View>

            {/* Suggestions pendant la frappe (métiers, artisans, villes) */}
            {!autourDeMoi && query.trim().length >= 2 && (suggestions ?? []).length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.suggestions}
                    style={{ flexGrow: 0 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {(suggestions ?? []).map((s) => (
                        <Pressable
                            key={`${s.type}-${s.value}`}
                            onPress={() => setQuery(s.value)}
                            style={styles.suggestionChip}
                            accessibilityRole="button"
                        >
                            <Text style={styles.suggestionText}>
                                {s.type === 'ville' ? '📍 ' : s.type === 'metier' ? '🔧 ' : ''}
                                {s.value}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            )}

            {/* Filtres : catégories, ou rayon en mode proximité */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
                style={{ flexGrow: 0 }}
            >
                {hasFilters && (
                    <Chip label="✕ Réinitialiser" selected={false} onPress={resetAll} />
                )}
                <Chip
                    label={locating ? '📍 Localisation…' : '📍 Autour de moi'}
                    selected={autourDeMoi}
                    onPress={() => void toggleAutourDeMoi()}
                />
                {autourDeMoi ? (
                    <>
                        <Chip
                            label={vueCarte ? '📋 Liste' : '🗺️ Carte'}
                            selected={vueCarte}
                            onPress={() => {
                                setSelectionCarte(null);
                                setVueCarte((v) => !v);
                            }}
                        />
                        {RAYONS_KM.map((r) => (
                            <Chip
                                key={r}
                                label={`${r} km`}
                                selected={rayon === r}
                                onPress={() => {
                                    setRayonAuto(false); // choix manuel : plus d'élargissement auto
                                    setRayon(r);
                                }}
                            />
                        ))}
                    </>
                ) : (
                    <>
                        <Chip
                            label="🔥 Urgences"
                            selected={urgence}
                            onPress={() => setUrgence((u) => !u)}
                        />
                        {(categories ?? []).map((cat) => (
                            <Chip
                                key={cat.id}
                                label={cat.nom}
                                selected={selectedCat === cat.slug}
                                onPress={() =>
                                    setSelectedCat((s) => (s === cat.slug ? undefined : cat.slug))
                                }
                            />
                        ))}
                    </>
                )}
            </ScrollView>

            {/* Vue carte : les artisans autour de moi, positionnés et cliquables */}
            {autourDeMoi && vueCarte ? (
                <View style={{ flex: 1 }}>
                    <LiveMap
                        point={position}
                        markers={artisans
                            .filter((a) => a.latitude != null && a.longitude != null)
                            .map((a) => ({
                                id: a.id,
                                latitude: a.latitude!,
                                longitude: a.longitude!,
                                label:
                                    a.nomEntreprise ??
                                    (`${a.user?.prenom ?? ''} ${a.user?.nom ?? ''}`.trim() ||
                                        'Artisan'),
                            }))}
                        onMarkerPress={(id) =>
                            setSelectionCarte(artisans.find((a) => a.id === id) ?? null)
                        }
                        style={{ flex: 1 }}
                    />
                    {/* Mini-fiche de l'artisan sélectionné sur la carte */}
                    {selectionCarte && (
                        <View style={styles.mapOverlay}>
                            <ArtisanCard
                                artisan={selectionCarte}
                                onPress={() =>
                                    router.push({
                                        pathname: '/artisan/[id]',
                                        params: { id: selectionCarte.id },
                                    })
                                }
                            />
                            <Pressable
                                onPress={() => setSelectionCarte(null)}
                                style={styles.mapOverlayClose}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel="Fermer la fiche"
                            >
                                <XCircle size={20} color={colors.textSecondary} strokeWidth={2} />
                            </Pressable>
                        </View>
                    )}
                    {/* Compteur flottant */}
                    <View style={styles.mapCount}>
                        <Text style={styles.mapCountText}>
                            {artisans.length} artisan{artisans.length > 1 ? 's' : ''} · {rayon} km
                        </Text>
                    </View>
                </View>
            ) : /* Résultats en liste */
            chargement && artisans.length === 0 ? (
                <View style={styles.list}>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} height={132} borderRadius={radii.lg} style={{ marginBottom: spacing.md }} />
                    ))}
                </View>
            ) : artisans.length === 0 ? (
                autourDeMoi ? (
                    filtreTexte ? (
                        <EmptyState
                            icon={<SearchX size={48} color={colors.textMuted} strokeWidth={1.5} />}
                            title="Aucun artisan proche ne correspond"
                            message={`Aucun artisan autour de vous ne correspond à « ${query.trim() }». Effacez le filtre pour tous les revoir.`}
                        />
                    ) : (
                        <EmptyState
                            icon={<MapPinOff size={48} color={colors.textMuted} strokeWidth={1.5} />}
                            title="Personne à proximité"
                            message={`Aucun artisan disponible dans un rayon de ${rayon} km pour le moment. Réessayez plus tard ou passez par la recherche classique.`}
                        />
                    )
                ) : (
                    <EmptyState
                        icon={<SearchX size={48} color={colors.textMuted} strokeWidth={1.5} />}
                        title="Aucun artisan trouvé"
                        message="Essayez un autre mot-clé ou élargissez les filtres."
                    />
                )
            ) : (
                <FlashList
                    data={artisans}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{
                        paddingHorizontal: spacing.xl,
                        paddingBottom: spacing['3xl'],
                    }}
                    ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
                    renderItem={({ item }) => (
                        <ArtisanCard
                            artisan={item}
                            onPress={() =>
                                router.push({ pathname: '/artisan/[id]', params: { id: item.id } })
                            }
                        />
                    )}
                    ListHeaderComponent={
                        <Text style={styles.count}>
                            {autourDeMoi
                                ? `${artisans.length} artisan(s) à moins de ${rayon} km, du plus proche au plus loin`
                                : `${data?.total ?? artisans.length} artisan(s)`}
                        </Text>
                    }
                />
            )}
        </SafeAreaView>
    );
}

function Chip({
    label,
    selected,
    onPress,
}: {
    label: string;
    selected: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.chip, selected && styles.chipSelected]}
        >
            <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    searchWrap: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.lg,
        height: 50,
    },
    searchInput: {
        flex: 1,
        fontFamily: typography.body,
        fontSize: fontSizes.md,
        color: colors.text,
    },
    chips: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
        gap: spacing.sm,
    },
    suggestions: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.xs,
        gap: spacing.sm,
    },
    suggestionChip: {
        paddingHorizontal: spacing.md,
        height: 32,
        justifyContent: 'center',
        borderRadius: radii.full,
        backgroundColor: colors.primarySoft,
    },
    suggestionText: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        color: colors.primary,
    },
    chip: {
        paddingHorizontal: spacing.lg,
        height: 36,
        justifyContent: 'center',
        borderRadius: radii.full,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    chipSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    chipLabel: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    chipLabelSelected: { color: colors.onPrimary },
    list: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.md,
    },
    mapOverlay: {
        position: 'absolute',
        left: spacing.md,
        right: spacing.md,
        bottom: spacing.md,
        ...shadows.raised,
    },
    mapOverlayClose: {
        position: 'absolute',
        top: -8,
        right: -4,
        backgroundColor: colors.surface,
        borderRadius: radii.full,
    },
    mapCount: {
        position: 'absolute',
        top: spacing.md,
        alignSelf: 'center',
        backgroundColor: colors.surface,
        borderRadius: radii.full,
        paddingHorizontal: spacing.md,
        paddingVertical: 5,
        ...shadows.card,
    },
    mapCountText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
        color: colors.text,
    },
    count: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        paddingVertical: spacing.md,
    },
});
