import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Search,
    Zap,
    ChevronRight,
    Bell,
    Gift,
    Wrench,
    Droplets,
    BrickWall,
    Hammer,
    PaintRoller,
    Snowflake,
    Scissors,
    Sparkles,
    Car,
    Leaf,
    LockKeyhole,
    MapPin,
    ShieldCheck,
    Handshake,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import {
    useCategories,
    useArtisanSearch,
    useNearbyArtisans,
    usePositionApprox,
} from '../../features/catalog/hooks';
import { ShowcaseCard } from '../../features/catalog/ShowcaseCard';
import { ArtisanVerificationCard, ArtisanQuotaCard } from '../../features/artisan/VerificationCard';
import { useUnreadCount } from '../../features/notifications/hooks';
import { Skeleton, SectionTitle, Avatar } from '../../components/ui';
import { useAuth } from '../../stores/auth';
import { ABONNEMENT_RANG } from '../../types/api';
import {
    colors,
    palette,
    spacing,
    typography,
    fontSizes,
    lineHeights,
    radii,
    categoryColors,
    shadows,
} from '../../theme/tokens';

/**
 * ACCUEIL — pensé « dans le vif du sujet » : l'utilisateur est là pour trouver
 * un artisan proche et le contacter, tout le reste s'efface.
 *
 * Hiérarchie : 1 problème (recherche + pannes courantes) → 2 urgence/proximité
 * → 3 métiers → 4 artisans près de chez vous → 5 confiance.
 */

/** Icône dédiée par catégorie — jamais d'emoji, toujours le même trait */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
    plomberie: Droplets,
    electricite: Zap,
    maconnerie: BrickWall,
    menuiserie: Hammer,
    peinture: PaintRoller,
    climatisation: Snowflake,
    couture: Scissors,
    coiffure: Sparkles,
    mecanique: Car,
    jardinage: Leaf,
};

/** Pannes et besoins les plus fréquents : un tap = recherche préremplie */
const PROBLEMES_COURANTS: { label: string; q: string; Icon: LucideIcon }[] = [
    { label: 'Fuite d\'eau', q: 'plombier', Icon: Droplets },
    { label: 'Panne de courant', q: 'électricien', Icon: Zap },
    { label: 'Clim en panne', q: 'climatisation', Icon: Snowflake },
    { label: 'Serrure bloquée', q: 'menuisier', Icon: LockKeyhole },
    { label: 'Peinture', q: 'peintre', Icon: PaintRoller },
];

function greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
}

export default function HomeScreen() {
    const router = useRouter();
    const user = useAuth((s) => s.user);
    const status = useAuth((s) => s.status);
    const { data: categories, isLoading, refetch, isRefetching } = useCategories();
    const { data: unreadCount } = useUnreadCount();

    // PROXIMITÉ D'ABORD : si la position est connue, la vitrine montre les
    // artisans réellement proches (vérifiés + disponibles + zone couvrante,
    // PREMIUM en tête puis distance). Sinon, repli sur les mieux notés.
    const positionApprox = usePositionApprox();
    const nearby = useNearbyArtisans(positionApprox, 15);
    const { data: featured } = useArtisanSearch(
        {
            limit: 8,
            latitude: positionApprox?.latitude,
            longitude: positionApprox?.longitude,
        },
        // La recherche classique ne sert que de repli
        positionApprox == null || nearby.data?.length === 0,
    );

    const bestRated = React.useMemo(() => {
        if (!featured) return null;
        return [...featured.items].sort((a, b) => {
            const rang = ABONNEMENT_RANG[b.abonnementType] - ABONNEMENT_RANG[a.abonnementType];
            if (rang !== 0) return rang;
            return Number(b.noteMoyenne) - Number(a.noteMoyenne);
        });
    }, [featured]);

    const proches = nearby.data && nearby.data.length > 0 ? nearby.data.slice(0, 8) : null;
    const vitrineItems = proches ?? bestRated;
    const vitrineTitre = proches ? 'Près de chez vous' : 'Les mieux notés';

    const goAuthOr = (path: Parameters<typeof router.push>[0]) => {
        router.push(status === 'authenticated' ? path : '/(auth)/login');
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={refetch}
                        tintColor={colors.primary}
                    />
                }
            >
                {/* ─── HERO : le problème de l'utilisateur, tout de suite ─── */}
                <LinearGradient
                    colors={[palette.navy800, palette.navy900]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0.8, y: 1 }}
                    style={styles.hero}
                >
                    <View style={styles.heroTop}>
                        <Text style={styles.greeting} numberOfLines={1}>
                            {greeting()}
                            {user?.prenom ? ` ${user.prenom}` : ''} 👋
                        </Text>
                        <Pressable
                            onPress={() => goAuthOr('/notifications')}
                            style={styles.bellButton}
                            accessibilityRole="button"
                            accessibilityLabel={
                                unreadCount
                                    ? `Notifications, ${unreadCount} non lues`
                                    : 'Notifications'
                            }
                        >
                            <Bell size={18} color={palette.white} strokeWidth={2} />
                            {!!unreadCount && <View style={styles.bellDot} />}
                        </Pressable>
                        <Pressable
                            onPress={() => router.push('/(tabs)/profil')}
                            accessibilityRole="button"
                            accessibilityLabel="Mon profil"
                        >
                            <Avatar
                                name={`${user?.prenom ?? ''} ${user?.nom ?? ''}`.trim() || 'Invité'}
                                uri={user?.photoUrl}
                                size={36}
                            />
                        </Pressable>
                    </View>

                    <Text style={styles.headline} numberOfLines={1} adjustsFontSizeToFit>
                        Quel est votre problème ?
                    </Text>
                    <Text style={styles.subHeadline} numberOfLines={1}>
                        Des artisans vérifiés, tout près de chez vous
                    </Text>

                    {/* LA porte d'entrée : la recherche */}
                    <Pressable
                        onPress={() => router.push('/(tabs)/recherche')}
                        style={({ pressed }) => [styles.searchBar, pressed && { opacity: 0.92 }]}
                        accessibilityRole="search"
                        accessibilityLabel="Rechercher un artisan"
                    >
                        <Search size={19} color={colors.primary} strokeWidth={2.2} />
                        <Text style={styles.searchPlaceholder}>
                            Plombier, coiffeuse, mécanicien…
                        </Text>
                    </Pressable>

                    {/* Pannes courantes : un tap et on y est */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.problemRow}
                        style={{ marginHorizontal: -spacing.xl }}
                    >
                        {PROBLEMES_COURANTS.map(({ label, q, Icon }) => (
                            <Pressable
                                key={label}
                                onPress={() =>
                                    router.push({
                                        pathname: '/(tabs)/recherche',
                                        params: { q },
                                    })
                                }
                                style={({ pressed }) => [
                                    styles.problemChip,
                                    pressed && { backgroundColor: 'rgba(255,255,255,0.28)' },
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={`Rechercher : ${label}`}
                            >
                                <Icon size={13} color={palette.white} strokeWidth={2.2} />
                                <Text style={styles.problemChipText}>{label}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                </LinearGradient>

                {/* Artisan : vérification du profil puis rappel de quota */}
                <View style={{ marginTop: spacing.md }}>
                    <ArtisanVerificationCard />
                    <ArtisanQuotaCard />
                </View>

                {/* ─── Deux gestes forts : urgence et proximité ─── */}
                <View style={styles.bigActions}>
                    <Pressable
                        onPress={() =>
                            router.push({ pathname: '/(tabs)/recherche', params: { urgence: '1' } })
                        }
                        style={({ pressed }) => [
                            styles.bigAction,
                            styles.bigActionSos,
                            pressed && { transform: [{ scale: 0.98 }] },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="SOS urgence : un artisan en moins d'une heure"
                    >
                        <View style={[styles.bigActionIcon, { backgroundColor: palette.red600 }]}>
                            <Zap size={15} color={palette.white} fill={palette.white} strokeWidth={0} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text
                                style={[styles.bigActionTitle, { color: palette.red700 }]}
                                numberOfLines={1}
                            >
                                SOS Urgence
                            </Text>
                            <Text style={styles.bigActionText} numberOfLines={1}>
                                En moins d'1 h
                            </Text>
                        </View>
                    </Pressable>
                    <Pressable
                        onPress={() =>
                            router.push({ pathname: '/(tabs)/recherche', params: { autour: '1' } })
                        }
                        style={({ pressed }) => [
                            styles.bigAction,
                            pressed && { transform: [{ scale: 0.98 }] },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Voir les artisans autour de moi sur la carte"
                    >
                        <View style={[styles.bigActionIcon, { backgroundColor: colors.primary }]}>
                            <MapPin size={15} color={palette.white} strokeWidth={2.2} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.bigActionTitle} numberOfLines={1}>
                                Autour de moi
                            </Text>
                            <Text style={styles.bigActionText} numberOfLines={1}>
                                Voir la carte
                            </Text>
                        </View>
                    </Pressable>
                </View>

                {/* ─── Main-d'œuvre (patron ↔ ouvriers/aides) ─── */}
                <Pressable
                    onPress={() => router.push('/main-doeuvre')}
                    style={({ pressed }) => [styles.moCard, pressed && { transform: [{ scale: 0.99 }] }]}
                    accessibilityRole="button"
                    accessibilityLabel="Trouver de la main-d'œuvre pour un chantier"
                >
                    <View style={[styles.bigActionIcon, { backgroundColor: palette.terracotta600 }]}>
                        <Hammer size={15} color={palette.white} strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.bigActionTitle} numberOfLines={1}>
                            Besoin de renfort sur un chantier ?
                        </Text>
                        <Text style={styles.bigActionText} numberOfLines={1}>
                            Trouvez un ouvrier ou une aide près de vous
                        </Text>
                    </View>
                    <ChevronRight size={17} color={colors.textMuted} strokeWidth={2.2} />
                </Pressable>

                {/* ─── Par métier ─── */}
                <SectionTitle
                    title="Ou par métier"
                    style={styles.sectionPadding}
                    action={
                        <Pressable
                            onPress={() => router.push('/(tabs)/recherche')}
                            hitSlop={8}
                            accessibilityRole="button"
                        >
                            <Text style={styles.seeAll}>Tout voir</Text>
                        </Pressable>
                    }
                />
                {isLoading && !categories ? (
                    <View style={styles.grid}>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <View key={i} style={styles.gridItem}>
                                <Skeleton width={50} height={50} borderRadius={radii.md} />
                                <Skeleton width={46} height={9} style={{ marginTop: spacing.xs }} />
                            </View>
                        ))}
                    </View>
                ) : (
                    <View style={styles.grid}>
                        {(categories ?? []).slice(0, 8).map((cat) => {
                            const catPalette = categoryColors[cat.slug] ?? categoryColors.default;
                            const Icon = CATEGORY_ICONS[cat.slug] ?? Wrench;
                            return (
                                <Pressable
                                    key={cat.id}
                                    style={styles.gridItem}
                                    onPress={() =>
                                        router.push({
                                            pathname: '/(tabs)/recherche',
                                            params: { categorie: cat.slug },
                                        })
                                    }
                                    accessibilityRole="button"
                                    accessibilityLabel={`Catégorie ${cat.nom}`}
                                >
                                    <View
                                        style={[styles.gridIcon, { backgroundColor: catPalette.bg }]}
                                    >
                                        <Icon size={21} color={catPalette.fg} strokeWidth={1.9} />
                                    </View>
                                    <Text style={styles.gridLabel} numberOfLines={1}>
                                        {cat.nom.split(' ')[0].replace('&', '')}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                )}

                {/* ─── Près de chez vous : LA vitrine proximité ─── */}
                <SectionTitle
                    title={vitrineTitre}
                    style={styles.sectionPadding}
                    action={
                        <Pressable
                            onPress={() =>
                                router.push({
                                    pathname: '/(tabs)/recherche',
                                    params: proches ? { autour: '1' } : {},
                                })
                            }
                            hitSlop={8}
                            accessibilityRole="button"
                        >
                            <Text style={styles.seeAll}>Tout voir</Text>
                        </Pressable>
                    }
                />
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.featuredRow}
                    style={styles.featuredScroll}
                >
                    {!vitrineItems
                        ? Array.from({ length: 3 }).map((_, i) => (
                              <Skeleton key={i} width={196} height={168} borderRadius={radii.xl} />
                          ))
                        : vitrineItems.map((artisan) => (
                              <ShowcaseCard
                                  key={artisan.id}
                                  artisan={artisan}
                                  onPress={() =>
                                      router.push({
                                          pathname: '/artisan/[id]',
                                          params: { id: artisan.id },
                                      })
                                  }
                                  onRequireAuth={() => router.push('/(auth)/login')}
                              />
                          ))}
                </ScrollView>

                {/* ─── Pourquoi nous faire confiance ─── */}
                <View style={styles.trustStrip}>
                    <View style={styles.trustItem}>
                        <ShieldCheck size={15} color={palette.green700} strokeWidth={2.2} />
                        <Text style={styles.trustText}>
                            Identités et diplômes vérifiés par notre équipe
                        </Text>
                    </View>
                    <View style={styles.trustItem}>
                        <Handshake size={15} color={colors.accent} strokeWidth={2.2} />
                        <Text style={styles.trustText}>
                            Gratuit pour vous, prix à discuter en direct
                        </Text>
                    </View>
                </View>

                {/* Parrainage — coupon discret en bas de fil */}
                <Pressable
                    onPress={() => goAuthOr('/(tabs)/profil')}
                    accessibilityRole="button"
                    accessibilityLabel="Parrainage : gagnez 1 000 francs"
                    style={({ pressed }) => [styles.referralCoupon, pressed && { opacity: 0.85 }]}
                >
                    <Gift size={15} color="#047857" strokeWidth={2} />
                    <Text style={styles.referralCouponText}>
                        Parrainez un ami : <Text style={styles.referralCouponStrong}>+1 000 F</Text>{' '}
                        pour vous, 500 F pour lui
                    </Text>
                    <ChevronRight size={14} color="#047857" strokeWidth={2.2} />
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: {
        paddingBottom: spacing['2xl'],
    },
    sectionPadding: {
        paddingHorizontal: spacing.xl,
        marginBottom: spacing.sm,
        marginTop: spacing.md,
    },

    // ─── Hero ────────────────────────────────────────────────────────────────
    hero: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.xs,
        paddingBottom: spacing.lg,
        borderBottomLeftRadius: radii.xl,
        borderBottomRightRadius: radii.xl,
    },
    heroTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    greeting: {
        flex: 1,
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: 'rgba(255,255,255,0.85)',
    },
    bellButton: {
        width: 38,
        height: 38,
        borderRadius: radii.full,
        backgroundColor: 'rgba(255,255,255,0.14)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bellDot: {
        position: 'absolute',
        top: 9,
        right: 10,
        width: 8,
        height: 8,
        borderRadius: radii.full,
        backgroundColor: palette.red600,
        borderWidth: 1.5,
        borderColor: palette.navy800,
    },
    headline: {
        fontFamily: typography.heading,
        fontSize: fontSizes.xl,
        lineHeight: lineHeights.xl,
        color: palette.white,
        letterSpacing: -0.4,
    },
    subHeadline: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: 'rgba(255,255,255,0.75)',
        marginTop: 1,
        marginBottom: spacing.md,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: palette.white,
        borderRadius: radii.lg,
        paddingHorizontal: spacing.lg,
        height: 46,
        ...shadows.raised,
    },
    searchPlaceholder: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    problemRow: {
        paddingHorizontal: spacing.xl,
        gap: spacing.sm,
        paddingTop: spacing.sm + 2,
    },
    problemChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        height: 30,
        paddingHorizontal: spacing.md,
        borderRadius: radii.full,
        backgroundColor: 'rgba(255,255,255,0.14)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    problemChipText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
        color: palette.white,
    },

    // ─── Grandes actions ─────────────────────────────────────────────────────
    bigActions: {
        flexDirection: 'row',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        marginTop: spacing.md,
    },
    bigAction: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        height: 54,
        ...shadows.card,
    },
    bigActionSos: {
        backgroundColor: '#FFF5F5',
        borderColor: palette.red100,
    },
    moCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        marginHorizontal: spacing.xl,
        marginTop: spacing.md,
        ...shadows.card,
    },
    bigActionIcon: {
        width: 30,
        height: 30,
        borderRadius: radii.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bigActionTitle: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.xs,
        color: colors.text,
    },
    bigActionText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs - 2,
        color: colors.textSecondary,
    },

    // ─── Catégories ──────────────────────────────────────────────────────────
    seeAll: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
        color: colors.primary,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: spacing.xl,
        rowGap: spacing.md,
    },
    gridItem: {
        width: '25%',
        alignItems: 'center',
        gap: spacing.xs,
    },
    gridIcon: {
        width: 50,
        height: 50,
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    gridLabel: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs - 1,
        color: colors.textSecondary,
    },

    // ─── Vitrine ─────────────────────────────────────────────────────────────
    featuredScroll: {
        flexGrow: 0,
    },
    featuredRow: {
        paddingHorizontal: spacing.xl,
        gap: spacing.md,
        // Le badge TOP/GOLD dépasse du haut de la carte : lui laisser la place
        // sinon le ScrollView horizontal le rogne
        paddingTop: 10,
    },

    // ─── Confiance ───────────────────────────────────────────────────────────
    trustStrip: {
        marginHorizontal: spacing.xl,
        marginTop: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        gap: spacing.xs + 2,
    },
    trustItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    trustText: {
        flex: 1,
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },

    // ─── Parrainage ──────────────────────────────────────────────────────────
    referralCoupon: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginHorizontal: spacing.xl,
        marginTop: spacing.md,
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#BBF7D0',
        borderRadius: radii.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
    },
    referralCouponText: {
        flex: 1,
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: '#065F46',
    },
    referralCouponStrong: {
        fontFamily: typography.bodyBold,
        color: '#047857',
    },
});
