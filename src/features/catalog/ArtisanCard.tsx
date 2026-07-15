import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Star, BadgeCheck, Zap, MapPin } from 'lucide-react-native';
import { Avatar } from '../../components/ui';
import type { ArtisanSummary } from '../../types/api';
import {
    colors,
    palette,
    spacing,
    typography,
    fontSizes,
    radii,
    shadows,
} from '../../theme/tokens';

/**
 * Carte artisan (résultats de recherche) — compacte et stratégique :
 * - Disponibilité = point de statut sur la photo (code universel, zéro place)
 * - Vérifié = badge bleu collé au nom (là où l'œil lit)
 * - PROXIMITÉ = l'info de décision, à droite (jamais de prix : au Bénin,
 *   le tarif se discute entre client et artisan, pas sur une carte)
 * - Urgences = éclair discret sous la distance
 * - PREMIUM = liseré doré + pastille "TOP" sur la bordure
 */
export function ArtisanCard({
    artisan,
    onPress,
}: {
    artisan: ArtisanSummary;
    onPress?: () => void;
}) {
    const nomAffiche =
        artisan.nomEntreprise ??
        `${artisan.user?.prenom ?? ''} ${artisan.user?.nom ?? ''}`.trim() ??
        'Artisan';
    const metierPrincipal =
        artisan.metierPrincipal?.nom ??
        artisan.metiers?.find((m) => m.estPrincipal)?.metier.nom ??
        artisan.metiers?.[0]?.metier.nom;
    const isGold = artisan.abonnementType === 'GOLD';
    const isPremium = isGold || artisan.abonnementType === 'PREMIUM';

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`Voir le profil de ${nomAffiche}${artisan.disponible ? ', disponible' : ''}`}
            style={({ pressed }) => [pressed && { transform: [{ scale: 0.99 }] }]}
        >
            <View style={[styles.card, isPremium && styles.cardPremium]}>
                {/* Photo + point de statut (vert = disponible) */}
                <View>
                    <Avatar
                        name={nomAffiche}
                        uri={artisan.photoProfilUrl ?? artisan.user?.photoUrl}
                        size={52}
                    />
                    <View
                        style={[
                            styles.statusDot,
                            {
                                backgroundColor: artisan.disponible
                                    ? palette.green600
                                    : palette.slate300,
                            },
                        ]}
                        accessibilityLabel={artisan.disponible ? 'Disponible' : 'Occupé'}
                    />
                </View>

                {/* Identité */}
                <View style={styles.info}>
                    <View style={styles.nameRow}>
                        <Text style={styles.name} numberOfLines={1}>
                            {nomAffiche}
                        </Text>
                        {artisan.verified && (
                            <BadgeCheck size={14} color={colors.primary} strokeWidth={2.4} />
                        )}
                    </View>
                    {metierPrincipal ? (
                        <Text style={styles.metier} numberOfLines={1}>
                            {metierPrincipal}
                        </Text>
                    ) : null}
                    <View style={styles.metaRow}>
                        <Star size={11} color="#F59E0B" fill="#F59E0B" strokeWidth={0} />
                        <Text style={styles.rating}>
                            {Number(artisan.noteMoyenne).toFixed(1)}
                        </Text>
                        <Text style={styles.metaMuted} numberOfLines={1}>
                            ({artisan.nombreAvis}) · {artisan.villePrincipale}
                        </Text>
                    </View>
                </View>

                {/* Proximité + urgences — la colonne de décision */}
                <View style={styles.right}>
                    {artisan.distanceKm != null ? (
                        <>
                            <View style={styles.distanceRow}>
                                <MapPin size={12} color={colors.primary} strokeWidth={2.4} />
                                <Text style={styles.distance}>
                                    {artisan.distanceKm < 10
                                        ? artisan.distanceKm.toFixed(1).replace('.', ',')
                                        : Math.round(artisan.distanceKm)}{' '}
                                    km
                                </Text>
                            </View>
                            <Text style={styles.priceUnit}>de vous</Text>
                        </>
                    ) : (
                        <Text style={styles.priceUnit}>{artisan.villePrincipale}</Text>
                    )}
                    {artisan.accepteUrgences && (
                        <View style={styles.urgentChip}>
                            <Zap
                                size={9}
                                color={palette.red600}
                                fill={palette.red600}
                                strokeWidth={0}
                            />
                            <Text style={styles.urgentText}>Urgences</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* "TOP"/"GOLD" à cheval sur la bordure (mise en avant payée) */}
            {isPremium && (
                <View style={[styles.topBadge, isGold && { backgroundColor: '#B45309' }]}>
                    <Star size={8} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
                    <Text style={styles.topText}>{isGold ? 'GOLD' : 'TOP'}</Text>
                </View>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.card,
    },
    cardPremium: {
        borderColor: '#FCD34D',
        backgroundColor: '#FFFDF8',
    },
    topBadge: {
        position: 'absolute',
        top: -7,
        right: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: '#F59E0B',
        borderRadius: radii.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    topText: {
        fontFamily: typography.bodyBold,
        fontSize: 8,
        letterSpacing: 0.6,
        color: '#FFFFFF',
    },
    statusDot: {
        position: 'absolute',
        bottom: 1,
        right: 1,
        width: 13,
        height: 13,
        borderRadius: radii.full,
        borderWidth: 2,
        borderColor: colors.surface,
    },
    info: {
        flex: 1,
        gap: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    name: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.base,
        color: colors.text,
        flexShrink: 1,
    },
    metier: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        color: colors.primary,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginTop: 1,
    },
    rating: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
        color: colors.text,
    },
    metaMuted: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        flexShrink: 1,
    },
    right: {
        alignItems: 'flex-end',
        gap: 1,
        minWidth: 64,
    },
    distanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    distance: {
        fontFamily: typography.headingMedium,
        fontSize: fontSizes.base,
        color: colors.primary,
        letterSpacing: -0.2,
    },
    priceUnit: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs - 1,
        color: colors.textMuted,
    },
    urgentChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: palette.red100,
        borderRadius: radii.full,
        paddingHorizontal: spacing.sm - 1,
        paddingVertical: 2,
        marginTop: 3,
    },
    urgentText: {
        fontFamily: typography.bodySemiBold,
        fontSize: 9,
        color: palette.red700,
    },
});
