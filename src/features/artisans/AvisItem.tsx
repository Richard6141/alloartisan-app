import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import { Star, CornerDownRight, Flag } from 'lucide-react-native';
import { Avatar, Button } from '../../components/ui';
import { useAuth } from '../../stores/auth';
import type { Avis, RaisonSignalement } from './hooks';
import { useRespondAvis, useReportAvis } from './hooks';
import { colors, spacing, typography, fontSizes, lineHeights, radii } from '../../theme/tokens';

const LONG_THRESHOLD = 140;

const RAISONS: { key: RaisonSignalement; label: string }[] = [
    { key: 'CONTENU_INAPPROPRIE', label: 'Contenu inapproprié' },
    { key: 'FAUX_AVIS', label: 'Faux avis' },
    { key: 'HARCELEMENT', label: 'Harcèlement' },
    { key: 'AUTRE', label: 'Autre' },
];

/**
 * Carte d'avis client : photo de profil, nom, date, note en étoiles,
 * commentaire replié au-delà de 3 lignes (« Lire plus »).
 * `canReply` : l'artisan propriétaire peut répondre. Tout utilisateur connecté
 * peut signaler un avis abusif.
 */
export function AvisItem({
    avis,
    artisanId,
    canReply = false,
}: {
    avis: Avis;
    artisanId?: string;
    canReply?: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const [replying, setReplying] = useState(false);
    const [reponse, setReponse] = useState('');
    const isAuthenticated = useAuth((s) => s.status === 'authenticated');
    const isLong = (avis.commentaire?.length ?? 0) > LONG_THRESHOLD;

    const respond = useRespondAvis(artisanId ?? '');
    const report = useReportAvis();

    const nom = avis.client?.prenom
        ? `${avis.client.prenom} ${avis.client?.nom?.charAt(0) ?? ''}.`.trim()
        : 'Client';
    const date = new Date(avis.createdAt).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });

    const sendReponse = () => {
        if (!reponse.trim() || !artisanId) return;
        respond.mutate(
            { avisId: avis.id, reponse: reponse.trim() },
            {
                onSuccess: () => {
                    setReplying(false);
                    setReponse('');
                    Alert.alert('Réponse publiée ✅', 'Votre réponse est visible sous l’avis.');
                },
                onError: () =>
                    Alert.alert('Impossible', 'Réponse non enregistrée. Réessayez.'),
            },
        );
    };

    const signaler = () => {
        Alert.alert(
            'Signaler cet avis',
            'Pourquoi signalez-vous cet avis ?',
            [
                ...RAISONS.map((r) => ({
                    text: r.label,
                    onPress: () =>
                        report.mutate(
                            { avisId: avis.id, raison: r.key },
                            {
                                onSuccess: () =>
                                    Alert.alert(
                                        'Merci',
                                        'Signalement transmis à notre équipe de modération.',
                                    ),
                                onError: () =>
                                    Alert.alert('Impossible', 'Signalement non envoyé. Réessayez.'),
                            },
                        ),
                })),
                { text: 'Annuler', style: 'cancel' as const },
            ],
        );
    };

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

            {/* Composer la réponse artisan (propriétaire, avis sans réponse) */}
            {canReply && !avis.reponseArtisan ? (
                replying ? (
                    <View style={styles.replyBox}>
                        <TextInput
                            value={reponse}
                            onChangeText={setReponse}
                            placeholder="Votre réponse (publique)…"
                            placeholderTextColor={colors.textMuted}
                            style={styles.replyInput}
                            multiline
                            maxLength={1000}
                            autoFocus
                        />
                        <View style={styles.replyActions}>
                            <Button
                                title="Annuler"
                                variant="ghost"
                                size="sm"
                                onPress={() => {
                                    setReplying(false);
                                    setReponse('');
                                }}
                            />
                            <Button
                                title="Publier"
                                size="sm"
                                loading={respond.isPending}
                                onPress={sendReponse}
                            />
                        </View>
                    </View>
                ) : (
                    <Pressable style={styles.actionRow} onPress={() => setReplying(true)} hitSlop={8}>
                        <CornerDownRight size={14} color={colors.primary} strokeWidth={2} />
                        <Text style={styles.actionTxt}>Répondre</Text>
                    </Pressable>
                )
            ) : null}

            {/* Signaler (tout utilisateur connecté) */}
            {isAuthenticated && (
                <Pressable style={styles.reportRow} onPress={signaler} hitSlop={8}>
                    <Flag size={12} color={colors.textMuted} strokeWidth={2} />
                    <Text style={styles.reportTxt}>Signaler</Text>
                </Pressable>
            )}
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
    replyBox: { gap: spacing.sm },
    replyInput: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.text,
        backgroundColor: colors.surfaceMuted,
        borderRadius: radii.sm,
        padding: spacing.sm,
        minHeight: 64,
        textAlignVertical: 'top',
    },
    replyActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    actionTxt: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
        color: colors.primary,
    },
    reportRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
    },
    reportTxt: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs - 1,
        color: colors.textMuted,
    },
});
