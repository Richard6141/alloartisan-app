import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Star, Heart, BadgeCheck } from 'lucide-react-native';
import { useFavorisSet, useToggleFavori } from '../favoris/hooks';
import { useAuth } from '../../stores/auth';
import { Avatar } from '../../components/ui';
import { optimizedImage } from '../../lib/image';
import type { ArtisanSummary } from '../../types/api';
import {
    palette,
    spacing,
    typography,
    fontSizes,
    radii,
    shadows,
} from '../../theme/tokens';

/**
 * Carte vitrine « à la une » — photo de couverture plein cadre avec infos
 * en surimpression :
 * - note ⭐ flottante en haut à gauche (avis vérifiés : seuls les clients
 *   ayant terminé une intervention peuvent noter)
 * - cœur favori en haut à droite (bascule optimiste)
 * - PHOTO DE PROFIL ronde cerclée de blanc au-dessus du nom
 * - badge « TOP » doré à cheval sur la bordure pour les artisans PREMIUM
 */
export function ShowcaseCard({
    artisan,
    onPress,
    onRequireAuth,
}: {
    artisan: ArtisanSummary;
    onPress: () => void;
    onRequireAuth: () => void;
}) {
    const status = useAuth((s) => s.status);
    const favoris = useFavorisSet();
    const toggleFavori = useToggleFavori();

    const nom =
        artisan.nomEntreprise ??
        `${artisan.user?.prenom ?? ''} ${artisan.user?.nom ?? ''}`.trim() ??
        'Artisan';
    const metier =
        artisan.metierPrincipal?.nom ??
        artisan.metiers?.find((m) => m.estPrincipal)?.metier.nom ??
        '';
    const isFavori = favoris.has(artisan.id);
    const isGold = artisan.abonnementType === 'GOLD';
    const isPremium = isGold || artisan.abonnementType === 'PREMIUM';

    const onHeart = () => {
        if (status !== 'authenticated') {
            onRequireAuth();
            return;
        }
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        toggleFavori.mutate({ artisan, isFavori });
    };

    return (
        // Enveloppe SANS overflow hidden : le badge TOP peut chevaucher la bordure
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`Voir le profil de ${nom}`}
            style={({ pressed }) => [styles.wrap, pressed && { transform: [{ scale: 0.98 }] }]}
        >
            <View style={[styles.card, isPremium && styles.cardPremium]}>
                {/* Photo de couverture (repli : dégradé navy) */}
                {artisan.photoCouvertureUrl ? (
                    <Image
                        source={{ uri: optimizedImage(artisan.photoCouvertureUrl, { width: 520 }) }}
                        style={StyleSheet.absoluteFill}
                        cachePolicy="memory-disk"
                        transition={200}
                        contentFit="cover"
                    />
                ) : (
                    <LinearGradient
                        colors={[palette.navy600, palette.navy900]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                )}

                {/* Dégradé de lisibilité en bas */}
                <LinearGradient
                    colors={['transparent', 'rgba(10,18,42,0.5)', 'rgba(10,18,42,0.94)']}
                    locations={[0.28, 0.55, 1]}
                    style={StyleSheet.absoluteFill}
                />

                {/* Note flottante */}
                <View style={styles.ratingBadge}>
                    <Star size={10} color="#F59E0B" fill="#F59E0B" strokeWidth={0} />
                    <Text style={styles.ratingText}>
                        {Number(artisan.noteMoyenne).toFixed(1)}
                    </Text>
                    <Text style={styles.ratingCount}>({artisan.nombreAvis})</Text>
                </View>

                {/* Cœur favori */}
                <Pressable
                    onPress={onHeart}
                    hitSlop={10}
                    style={styles.heartButton}
                    accessibilityRole="button"
                    accessibilityLabel={isFavori ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    accessibilityState={{ selected: isFavori }}
                >
                    <Heart
                        size={15}
                        color={isFavori ? '#F43F5E' : '#FFFFFF'}
                        fill={isFavori ? '#F43F5E' : 'transparent'}
                        strokeWidth={2.2}
                    />
                </Pressable>

                {/* Infos en surimpression : photo de profil + identité + prix */}
                <View style={styles.overlay}>
                    <View style={styles.avatarRing}>
                        <Avatar
                            name={nom}
                            uri={artisan.photoProfilUrl ?? artisan.user?.photoUrl}
                            size={38}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        {metier ? (
                            <Text style={styles.metier} numberOfLines={1}>
                                {metier}
                            </Text>
                        ) : null}
                        <View style={styles.nameRow}>
                            <Text style={styles.name} numberOfLines={1}>
                                {nom}
                            </Text>
                            {artisan.verified && (
                                <BadgeCheck size={13} color="#7EB6FF" strokeWidth={2.4} />
                            )}
                        </View>
                        <View style={styles.bottomRow}>
                            <Text style={styles.city} numberOfLines={1}>
                                {artisan.villePrincipale}
                            </Text>
                            {/* Proximité plutôt que prix : le tarif se discute
                                entre client et artisan, jamais sur une carte */}
                            {artisan.distanceKm != null && (
                                <View style={styles.priceChip}>
                                    <Text style={styles.priceText}>
                                        📍 {artisan.distanceKm < 10
                                            ? artisan.distanceKm.toFixed(1).replace('.', ',')
                                            : Math.round(artisan.distanceKm)}{' '}
                                        km
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </View>

            {/* Badge « TOP »/« GOLD » à cheval sur la bordure supérieure */}
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
    wrap: {
        // overflow visible par défaut : le badge TOP déborde du cadre
    },
    card: {
        width: 196,
        height: 172,
        borderRadius: radii.xl,
        overflow: 'hidden',
        backgroundColor: palette.navy800,
        ...shadows.card,
    },
    cardPremium: {
        borderWidth: 1.5,
        borderColor: '#F59E0B',
    },
    topBadge: {
        position: 'absolute',
        top: -8,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: '#F59E0B',
        borderRadius: radii.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2.5,
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
        ...shadows.card,
    },
    topText: {
        fontFamily: typography.bodyBold,
        fontSize: 8,
        letterSpacing: 0.6,
        color: '#FFFFFF',
    },
    ratingBadge: {
        position: 'absolute',
        top: spacing.sm + 2,
        left: spacing.sm + 2,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(10,18,42,0.65)',
        borderRadius: radii.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
    },
    ratingText: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.xs - 1,
        color: '#FFFFFF',
    },
    ratingCount: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs - 2,
        color: 'rgba(255,255,255,0.7)',
    },
    heartButton: {
        position: 'absolute',
        top: spacing.sm,
        right: spacing.sm,
        width: 30,
        height: 30,
        borderRadius: radii.full,
        backgroundColor: 'rgba(10,18,42,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    overlay: {
        position: 'absolute',
        left: spacing.sm + 2,
        right: spacing.sm + 2,
        bottom: spacing.sm + 2,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: spacing.sm,
    },
    avatarRing: {
        borderWidth: 2,
        borderColor: '#FFFFFF',
        borderRadius: radii.full,
        backgroundColor: palette.navy800,
    },
    metier: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs - 2,
        color: 'rgba(255,255,255,0.75)',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    name: {
        fontFamily: typography.headingMedium,
        fontSize: fontSizes.sm,
        color: '#FFFFFF',
        flexShrink: 1,
        letterSpacing: -0.2,
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
        marginTop: 2,
    },
    city: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs - 1,
        color: 'rgba(255,255,255,0.65)',
        flexShrink: 1,
    },
    priceChip: {
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderRadius: radii.full,
        paddingHorizontal: spacing.sm + 1,
        paddingVertical: 2.5,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
    },
    priceText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs - 1,
        color: '#FFFFFF',
    },
});
