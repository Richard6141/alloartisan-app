import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Star, MapPin, ShieldCheck, Hammer, HardHat } from 'lucide-react-native';
import { Avatar } from '../../components/ui';
import type { ProfilTravailleur } from '../../types/api';
import { colors, palette, spacing, typography, fontSizes, radii, shadows } from '../../theme/tokens';

/** Carte d'un travailleur (ouvrier/aide) dans la recherche « Main-d'œuvre ». */
export function TravailleurCard({
    travailleur: t,
    onPress,
}: {
    travailleur: ProfilTravailleur;
    onPress?: () => void;
}) {
    const nom =
        `${t.user?.prenom ?? ''} ${t.user?.nom ?? ''}`.trim() ||
        (t.type === 'OUVRIER' ? 'Ouvrier' : 'Aide');
    const estOuvrier = t.type === 'OUVRIER';
    const metierPrincipal = t.metiers?.find((m) => m.estPrincipal)?.metier?.nom;
    const label = t.polyvalent ? 'Polyvalent · tous chantiers' : metierPrincipal ?? 'Main-d’œuvre';
    const note = Number(t.noteMoyenne) || 0;

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`Voir ${nom}`}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
        >
            <View>
                <Avatar name={nom} uri={t.user?.photoUrl ?? undefined} size={52} />
                {t.disponibleMaintenant && <View style={styles.dot} />}
            </View>

            <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                        {nom}
                    </Text>
                    {t.identiteVerifiee && (
                        <ShieldCheck size={15} color={colors.primary} strokeWidth={2.4} />
                    )}
                </View>
                <View style={styles.typeRow}>
                    {estOuvrier ? (
                        <Hammer size={13} color={palette.terracotta600} strokeWidth={2.2} />
                    ) : (
                        <HardHat size={13} color={palette.terracotta600} strokeWidth={2.2} />
                    )}
                    <Text style={styles.type}>{estOuvrier ? 'Ouvrier' : 'Aide'}</Text>
                    <Text style={styles.metier} numberOfLines={1}>
                        · {label}
                    </Text>
                </View>
                <View style={styles.metaRow}>
                    <Star size={12} color={palette.amber600} fill={palette.amber600} strokeWidth={0} />
                    <Text style={styles.meta}>
                        {note > 0 ? note.toFixed(1) : 'Nouveau'}
                        {t.nombreAvis > 0 ? ` (${t.nombreAvis})` : ''} · {t.villePrincipale}
                    </Text>
                </View>
            </View>

            <View style={styles.right}>
                {t.distanceKm != null && (
                    <View style={styles.distanceRow}>
                        <MapPin size={12} color={colors.textSecondary} strokeWidth={2.2} />
                        <Text style={styles.distance}>
                            {t.distanceKm < 1
                                ? `${Math.round(t.distanceKm * 1000)} m`
                                : `${t.distanceKm.toFixed(1)} km`}
                        </Text>
                    </View>
                )}
                {t.tarifJournalier != null && (
                    <Text style={styles.tarif}>
                        {t.tarifJournalier.toLocaleString('fr-FR')} F/j
                    </Text>
                )}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.surface,
        marginHorizontal: spacing.xl,
        marginBottom: spacing.md,
        padding: spacing.md,
        borderRadius: radii.lg,
        ...shadows.card,
    },
    dot: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: 14,
        height: 14,
        borderRadius: radii.full,
        backgroundColor: palette.green600,
        borderWidth: 2,
        borderColor: colors.surface,
    },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    name: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.md,
        color: colors.text,
        flexShrink: 1,
    },
    typeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
    type: { fontFamily: typography.bodySemiBold, fontSize: fontSizes.xs, color: palette.terracotta700 },
    metier: { fontFamily: typography.body, fontSize: fontSizes.xs, color: colors.textSecondary, flexShrink: 1 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    meta: { fontFamily: typography.body, fontSize: fontSizes.xs, color: colors.textSecondary },
    right: { alignItems: 'flex-end', gap: 3 },
    distanceRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    distance: { fontFamily: typography.bodyMedium, fontSize: fontSizes.xs, color: colors.textSecondary },
    tarif: { fontFamily: typography.bodyBold, fontSize: fontSizes.sm, color: colors.primary },
});
