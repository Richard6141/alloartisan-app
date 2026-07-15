import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Star } from 'lucide-react-native';
import { Avatar } from '../../components/ui';
import type { Avis } from './hooks';
import { colors, spacing, typography, fontSizes, lineHeights, radii } from '../../theme/tokens';

const LONG_THRESHOLD = 140;

/**
 * Carte d'avis client : photo de profil, nom, date, note en étoiles,
 * commentaire replié au-delà de 3 lignes (« Lire plus »).
 */
export function AvisItem({ avis }: { avis: Avis }) {
    const [expanded, setExpanded] = useState(false);
    const isLong = (avis.commentaire?.length ?? 0) > LONG_THRESHOLD;

    const nom = avis.client?.prenom
        ? `${avis.client.prenom} ${avis.client?.nom?.charAt(0) ?? ''}.`.trim()
        : 'Client';
    const date = new Date(avis.createdAt).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });

    return (
        <View style={styles.card}>
            {/* En-tête : photo + nom + date + étoiles */}
            <View style={styles.header}>
                <Avatar name={nom} uri={avis.client?.photoUrl} size={34} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.author} numberOfLines={1}>
                        {nom}
                    </Text>
                    <Text style={styles.date}>{date}</Text>
                </View>
                <View style={styles.stars}>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                            key={i}
                            size={11}
                            color="#F59E0B"
                            fill={i < avis.note ? '#F59E0B' : 'transparent'}
                            strokeWidth={i < avis.note ? 0 : 1.5}
                        />
                    ))}
                </View>
            </View>

            {avis.commentaire ? (
                <>
                    <Text style={styles.text} numberOfLines={expanded ? undefined : 3}>
                        {avis.commentaire}
                    </Text>
                    {isLong && (
                        <Pressable
                            onPress={() => setExpanded((e) => !e)}
                            hitSlop={8}
                            accessibilityRole="button"
                        >
                            <Text style={styles.toggle}>
                                {expanded ? 'Réduire' : 'Lire plus'}
                            </Text>
                        </Pressable>
                    )}
                </>
            ) : null}

            {avis.reponseArtisan ? (
                <View style={styles.reply}>
                    <Text style={styles.replyLabel}>Réponse de l'artisan</Text>
                    <Text style={styles.text}>{avis.reponseArtisan}</Text>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.sm,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm + 2,
    },
    author: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    date: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs - 1,
        color: colors.textMuted,
        marginTop: 1,
    },
    stars: { flexDirection: 'row', gap: 1.5 },
    text: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 4,
        color: colors.textSecondary,
    },
    toggle: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
        color: colors.primary,
    },
    reply: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: radii.sm,
        padding: spacing.sm + 2,
        gap: 2,
    },
    replyLabel: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs - 1,
        color: colors.text,
    },
});
