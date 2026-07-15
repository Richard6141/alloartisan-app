import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ArrowLeft,
    Star,
    BadgeCheck,
    MapPin,
    Briefcase,
    MessageCircle,
    Zap,
    CalendarCheck,
    Medal,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useArtisan, useArtisanAvis, useStartConversation } from '../../features/artisans/hooks';
import { AvisItem } from '../../features/artisans/AvisItem';
import { api } from '../../lib/api';
import type { Certification } from '../../types/api';
import { Avatar, Button, Skeleton, SectionTitle } from '../../components/ui';
import { useAuth } from '../../stores/auth';
import {
    colors,
    palette,
    spacing,
    typography,
    fontSizes,
    lineHeights,
    radii,
    shadows,
} from '../../theme/tokens';

const COVER_HEIGHT = 180;

export default function ArtisanDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const status = useAuth((s) => s.status);
    const { data: artisan, isLoading } = useArtisan(id);
    const { data: avis } = useArtisanAvis(id);
    const startConversation = useStartConversation();

    const requireAuth = (action: () => void) => {
        if (status !== 'authenticated') {
            router.push('/(auth)/login');
            return;
        }
        action();
    };

    const openChat = () =>
        requireAuth(() => {
            startConversation.mutate(
                { artisanId: id },
                {
                    onSuccess: (conv) =>
                        router.push({
                            pathname: '/conversation/[id]',
                            params: {
                                id: conv.id,
                                nom: nomAffiche,
                            },
                        }),
                },
            );
        });

    const book = () =>
        requireAuth(() => {
            router.push({ pathname: '/booking/new', params: { artisanId: id } });
        });

    const nomAffiche =
        artisan?.nomEntreprise ??
        `${artisan?.user?.prenom ?? ''} ${artisan?.user?.nom ?? ''}`.trim() ??
        'Artisan';
    const isPremium =
        artisan?.abonnementType === 'PREMIUM' || artisan?.abonnementType === 'GOLD';

    if (isLoading || !artisan) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <Stack.Screen options={{ headerShown: false }} />
                <View style={{ padding: spacing.xl, gap: spacing.lg }}>
                    <Skeleton height={COVER_HEIGHT} borderRadius={radii.xl} />
                    <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                        <Skeleton width={76} height={76} borderRadius={radii.full} />
                        <View style={{ flex: 1, gap: spacing.sm, justifyContent: 'center' }}>
                            <Skeleton width="70%" height={18} />
                            <Skeleton width="45%" height={13} />
                        </View>
                    </View>
                    <Skeleton height={64} borderRadius={radii.lg} />
                    <Skeleton height={140} borderRadius={radii.lg} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* ─── HÉRO : couverture + dégradé ─── */}
                <View style={styles.hero}>
                    {artisan.photoCouvertureUrl ? (
                        <Image
                            source={{ uri: artisan.photoCouvertureUrl }}
                            style={StyleSheet.absoluteFill}
                            cachePolicy="memory-disk"
                            transition={200}
                            contentFit="cover"
                        />
                    ) : (
                        <LinearGradient
                            colors={[palette.navy800, palette.navy600]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                        />
                    )}
                    {/* Voile pour la lisibilité + fondu vers la feuille */}
                    <LinearGradient
                        colors={['rgba(15,23,42,0.25)', 'transparent', 'rgba(15,23,42,0.45)']}
                        style={StyleSheet.absoluteFill}
                    />
                </View>

                {/* ─── FEUILLE : contenu chevauchant la couverture ─── */}
                <View style={styles.sheet}>
                    {/* Identité — avatar à cheval sur le bord de la feuille */}
                    <View style={styles.identityRow}>
                        <View
                            style={[
                                styles.avatarRing,
                                { borderColor: isPremium ? '#F59E0B' : colors.surface },
                            ]}
                        >
                            <Avatar
                                name={nomAffiche}
                                uri={artisan.photoProfilUrl ?? artisan.user?.photoUrl}
                                size={72}
                            />
                            {isPremium && (
                                <View style={styles.topBadge}>
                                    <Star size={8} color="#FFF" fill="#FFF" strokeWidth={0} />
                                    <Text style={styles.topBadgeText}>TOP</Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.identityText}>
                            <View style={styles.nameRow}>
                                <Text style={styles.name} numberOfLines={2}>
                                    {nomAffiche}
                                </Text>
                                {artisan.verified && (
                                    <BadgeCheck size={17} color={colors.primary} strokeWidth={2.3} />
                                )}
                            </View>
                            {artisan.slogan ? (
                                <Text style={styles.slogan} numberOfLines={1}>
                                    « {artisan.slogan} »
                                </Text>
                            ) : null}
                            <View style={styles.locationRow}>
                                <MapPin size={11} color={colors.textMuted} strokeWidth={2} />
                                <Text style={styles.locationText}>
                                    {artisan.villePrincipale} · rayon{' '}
                                    {Number(artisan.zoneInterventionKm)} km
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Chips d'état — compactes, juste l'essentiel */}
                    <View style={styles.chipsRow}>
                        <View style={styles.stateChip}>
                            <View
                                style={[
                                    styles.stateDot,
                                    {
                                        backgroundColor: artisan.disponible
                                            ? palette.green600
                                            : palette.slate300,
                                    },
                                ]}
                            />
                            <Text style={styles.stateChipText}>
                                {artisan.disponible ? 'Disponible' : 'Occupé'}
                            </Text>
                        </View>
                        {artisan.accepteUrgences && (
                            <View style={[styles.stateChip, { backgroundColor: palette.red100 }]}>
                                <Zap
                                    size={10}
                                    color={palette.red600}
                                    fill={palette.red600}
                                    strokeWidth={0}
                                />
                                <Text style={[styles.stateChipText, { color: palette.red700 }]}>
                                    Urgences
                                </Text>
                            </View>
                        )}
                        {artisan.accepteWeekend && (
                            <View style={[styles.stateChip, { backgroundColor: colors.primarySoft }]}>
                                <CalendarCheck size={10} color={colors.primary} strokeWidth={2.4} />
                                <Text style={[styles.stateChipText, { color: colors.primary }]}>
                                    Week-end
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Bandeau de confiance — 3 stats segmentées */}
                    <View style={styles.statsStrip}>
                        <View style={styles.stat}>
                            <View style={styles.statTop}>
                                <Star size={13} color="#F59E0B" fill="#F59E0B" strokeWidth={0} />
                                <Text style={styles.statValue}>
                                    {Number(artisan.noteMoyenne).toFixed(1)}
                                </Text>
                            </View>
                            <Text style={styles.statLabel}>{artisan.nombreAvis} avis</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.stat}>
                            <View style={styles.statTop}>
                                <Briefcase size={13} color={colors.primary} strokeWidth={2.2} />
                                <Text style={styles.statValue}>
                                    {artisan.nombreMissionsCompletees}
                                </Text>
                            </View>
                            <Text style={styles.statLabel}>missions</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.stat}>
                            <View style={styles.statTop}>
                                <Medal size={13} color={colors.accent} strokeWidth={2.2} />
                                <Text style={styles.statValue}>{artisan.anneesExperience}</Text>
                            </View>
                            <Text style={styles.statLabel}>ans d'exp.</Text>
                        </View>
                    </View>

                    {/* PIVOT PROXIMITÉ : jamais de tarif affiché, le prix se
                        négocie directement (contexte béninois) */}
                    <View style={styles.priceStrip}>
                        <MessageCircle size={13} color={colors.textSecondary} strokeWidth={2} />
                        <Text style={styles.priceSecondary}>
                            Prix à discuter directement avec l'artisan
                        </Text>
                    </View>

                    {/* Métiers */}
                    {artisan.metiers && artisan.metiers.length > 0 && (
                        <View style={styles.metiersRow}>
                            {artisan.metiers.map((m) => (
                                <View
                                    key={m.metier.id}
                                    style={[
                                        styles.metierChip,
                                        m.estPrincipal && styles.metierChipMain,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.metierChipText,
                                            m.estPrincipal && { color: colors.onPrimary },
                                        ]}
                                    >
                                        {m.metier.nom}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* À propos */}
                    {artisan.bio ? <ExpandableBio text={artisan.bio} /> : null}

                    {/* Réalisations */}
                    {artisan.portfolioUrls && artisan.portfolioUrls.length > 0 && (
                        <>
                            <SectionTitle title="Réalisations" style={{ marginTop: spacing.lg }} />
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: spacing.sm }}
                                style={{ marginBottom: spacing.sm }}
                            >
                                {artisan.portfolioUrls.map((url, i) => (
                                    <Image
                                        key={url}
                                        source={{ uri: url }}
                                        style={[
                                            styles.portfolioImage,
                                            i === 0 && styles.portfolioImageFirst,
                                        ]}
                                        cachePolicy="memory-disk"
                                        transition={150}
                                        accessibilityLabel="Photo de réalisation"
                                    />
                                ))}
                            </ScrollView>
                        </>
                    )}

                    {/* Diplômes et certifications validés par l'équipe */}
                    <CertificationsVerifiees artisanId={id} />

                    {/* Avis — photos de profil, repliables, page dédiée si nombreux */}
                    {avis && avis.length > 0 && (
                        <>
                            <SectionTitle
                                title={`Avis clients (${artisan.nombreAvis})`}
                                style={{ marginTop: spacing.lg }}
                            />
                            <View style={{ gap: spacing.sm }}>
                                {avis.slice(0, 3).map((a) => (
                                    <AvisItem key={a.id} avis={a} />
                                ))}
                            </View>
                            {artisan.nombreAvis > 3 && (
                                <Button
                                    title={`Voir les ${artisan.nombreAvis} avis`}
                                    variant="ghost"
                                    size="sm"
                                    onPress={() =>
                                        router.push({
                                            pathname: '/avis/[artisanId]',
                                            params: { artisanId: id, nom: nomAffiche },
                                        })
                                    }
                                    style={{ marginTop: spacing.sm, alignSelf: 'center' }}
                                />
                            )}
                        </>
                    )}
                </View>
            </ScrollView>

            {/* Retour — flottant sur la couverture */}
            <Pressable
                onPress={() => router.back()}
                hitSlop={12}
                style={[styles.backButton, { top: insets.top + spacing.sm }]}
                accessibilityRole="button"
                accessibilityLabel="Retour"
            >
                <ArrowLeft size={20} color={colors.text} strokeWidth={2.2} />
            </Pressable>

            {/* Barre d'actions fixe */}
            <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
                <Button
                    title="Contacter"
                    variant="secondary"
                    icon={<MessageCircle size={17} color={colors.primary} strokeWidth={2} />}
                    loading={startConversation.isPending}
                    onPress={openChat}
                    style={{ flex: 1 }}
                />
                <Button title="Réserver" onPress={book} style={{ flex: 1.4 }} />
            </View>
        </View>
    );
}

/** Bio repliée sur 4 lignes avec « Lire plus » */
function ExpandableBio({ text }: { text: string }) {
    const [expanded, setExpanded] = useState(false);
    const isLong = text.length > 160;
    return (
        <View style={{ marginTop: spacing.md }}>
            <Text style={styles.bio} numberOfLines={expanded ? undefined : 4}>
                {text}
            </Text>
            {isLong && (
                <Pressable
                    onPress={() => setExpanded((e) => !e)}
                    hitSlop={8}
                    accessibilityRole="button"
                >
                    <Text style={styles.bioToggle}>{expanded ? 'Réduire' : 'Lire plus'}</Text>
                </Pressable>
            )}
        </View>
    );
}

/** Diplômes et certifications validés par l'équipe : gage de confiance visible */
function CertificationsVerifiees({ artisanId }: { artisanId: string }) {
    const { data } = useQuery({
        queryKey: ['certifications', 'artisan', artisanId],
        queryFn: async () => {
            const { data } = await api.get<{ data: Certification[]; total: number }>(
                `/certifications/artisan/${artisanId}`,
            );
            return data.data;
        },
        staleTime: 10 * 60 * 1000,
    });

    if (!data || data.length === 0) return null;

    return (
        <>
            <SectionTitle title="Diplômes et certifications" style={{ marginTop: spacing.lg }} />
            <View style={{ gap: spacing.sm }}>
                {data.map((c) => (
                    <View key={c.id} style={styles.certRow}>
                        <View style={styles.certIcon}>
                            <Medal size={16} color={palette.green700} strokeWidth={2.2} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.certTitle} numberOfLines={1}>
                                {c.titre}
                            </Text>
                            {!!c.organisme && (
                                <Text style={styles.certOrg} numberOfLines={1}>
                                    {c.organisme}
                                </Text>
                            )}
                        </View>
                        <BadgeCheck size={16} color={palette.green600} strokeWidth={2.2} />
                    </View>
                ))}
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { paddingBottom: 110 },
    hero: {
        height: COVER_HEIGHT,
        backgroundColor: palette.navy800,
    },
    sheet: {
        marginTop: -26,
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        backgroundColor: colors.background,
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.xl,
    },
    identityRow: {
        // L'avatar chevauche la couverture ; le TEXTE reste entièrement sur la
        // feuille claire (paddingTop) — jamais de texte sombre sur la photo.
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
        marginTop: -30,
        marginBottom: spacing.md,
    },
    avatarRing: {
        borderWidth: 3,
        borderRadius: radii.full,
        backgroundColor: colors.surface,
        ...shadows.raised,
    },
    topBadge: {
        position: 'absolute',
        bottom: -4,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: '#F59E0B',
        borderRadius: radii.full,
        paddingHorizontal: spacing.sm - 1,
        paddingVertical: 1.5,
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    topBadgeText: {
        fontFamily: typography.bodyBold,
        fontSize: 7.5,
        letterSpacing: 0.6,
        color: '#FFFFFF',
    },
    identityText: {
        flex: 1,
        paddingTop: 38, // sous le bord arrondi de la feuille
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    name: {
        fontFamily: typography.heading,
        fontSize: fontSizes.lg + 1,
        letterSpacing: -0.3,
        color: colors.text,
        flexShrink: 1,
    },
    slogan: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        fontStyle: 'italic',
        marginTop: 1,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginTop: 2,
    },
    locationText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },
    chipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm - 2,
        marginBottom: spacing.md,
    },
    stateChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: colors.surfaceMuted,
        borderRadius: radii.full,
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: 3.5,
    },
    stateDot: {
        width: 7,
        height: 7,
        borderRadius: radii.full,
    },
    stateChipText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs - 1,
        color: colors.textSecondary,
    },
    statsStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.md,
        marginBottom: spacing.sm,
        ...shadows.card,
    },
    stat: { flex: 1, alignItems: 'center', gap: 1 },
    statDivider: {
        width: 1,
        height: 28,
        backgroundColor: colors.border,
    },
    statTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    statValue: {
        fontFamily: typography.heading,
        fontSize: fontSizes.md,
        color: colors.text,
        letterSpacing: -0.2,
    },
    statLabel: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs - 1,
        color: colors.textSecondary,
    },
    priceStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        marginBottom: spacing.xs,
    },
    priceSecondary: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
    metiersRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm - 2,
    },
    metierChip: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: radii.full,
        paddingHorizontal: spacing.md,
        paddingVertical: 4,
    },
    metierChipMain: {
        backgroundColor: colors.primary,
    },
    metierChipText: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
    bio: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        lineHeight: lineHeights.sm + 4,
        color: colors.textSecondary,
    },
    bioToggle: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
        color: colors.primary,
        marginTop: spacing.xs,
    },
    certRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    certIcon: {
        width: 32,
        height: 32,
        borderRadius: radii.full,
        backgroundColor: colors.successSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    certTitle: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    certOrg: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: 1,
    },
    portfolioImage: {
        width: 124,
        height: 92,
        borderRadius: radii.md,
        backgroundColor: colors.surfaceMuted,
    },
    portfolioImageFirst: {
        width: 164,
        height: 92,
    },
    backButton: {
        position: 'absolute',
        left: spacing.xl,
        width: 38,
        height: 38,
        borderRadius: radii.full,
        backgroundColor: 'rgba(255,255,255,0.92)',
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.raised,
    },
    actionBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.md,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
});
