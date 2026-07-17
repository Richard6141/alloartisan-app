import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Lock, Sparkles, Gift, ShieldCheck, MessageSquare } from 'lucide-react-native';
import { Button } from './ui';
import type { PaywallGate } from '../types/api';
import { colors, palette, spacing, typography, fontSizes, lineHeights, radii } from '../theme/tokens';

interface Props {
    gate: PaywallGate;
    apercu?: { nbMessages?: number; dernierMessageAt?: string | null };
    clientNom?: string;
    unlocking?: boolean;
    onUnlock: () => void;
    onVoirAbonnements: () => void;
}

/**
 * Paywall AlloArtisan (anti-désintermédiation) : tant que l'artisan n'a pas
 * débloqué la conversation, il voit ce panneau au lieu des messages. Il
 * débloque via un essai découverte gratuit, puis via son abonnement.
 */
export function LockedConversation({
    gate,
    clientNom,
    unlocking,
    onUnlock,
    onVoirAbonnements,
}: Props) {
    const parEssai = gate.essaisRestants > 0;
    const peutDebloquer = gate.peutDebloquer;

    return (
        <ScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.iconWrap}>
                <Lock size={30} color={palette.terracotta600} strokeWidth={2.2} />
            </View>

            <Text style={styles.title}>
                {clientNom ? `${clientNom} vous a contacté` : 'Un client vous a contacté'}
            </Text>

            <View style={styles.previewCard}>
                <MessageSquare size={18} color={colors.primary} strokeWidth={2.2} />
                <Text style={styles.previewText}>
                    Un client attend votre réponse. Débloquez pour décrocher la
                    mission.
                </Text>
            </View>

            <Text style={styles.subtitle}>
                Sur AlloArtisan, chaque mise en relation est protégée : vous décidez à
                qui vous répondez. Un déblocage = une mission, et vous discutez ensuite
                autant que nécessaire.
            </Text>

            {parEssai ? (
                <View style={styles.gateRow}>
                    <Gift size={18} color={palette.green600} strokeWidth={2.2} />
                    <Text style={styles.gateText}>
                        {gate.essaisRestants} déblocage
                        {gate.essaisRestants > 1 ? 's' : ''} offert
                        {gate.essaisRestants > 1 ? 's' : ''} (essai découverte)
                    </Text>
                </View>
            ) : peutDebloquer ? (
                <View style={styles.gateRow}>
                    <Sparkles size={18} color={colors.primary} strokeWidth={2.2} />
                    <Text style={styles.gateText}>
                        {gate.demandesRestantes === null
                            ? 'Mises en relation illimitées'
                            : `${gate.demandesRestantes} mise${
                                  (gate.demandesRestantes ?? 0) > 1 ? 's' : ''
                              } en relation restante${
                                  (gate.demandesRestantes ?? 0) > 1 ? 's' : ''
                              } ce mois-ci`}
                    </Text>
                </View>
            ) : (
                <View style={styles.gateRow}>
                    <Sparkles size={18} color={palette.terracotta600} strokeWidth={2.2} />
                    <Text style={styles.gateText}>
                        Vos essais gratuits sont épuisés, abonnez-vous pour continuer.
                    </Text>
                </View>
            )}

            {peutDebloquer ? (
                <Button
                    title={parEssai ? 'Débloquer gratuitement' : 'Débloquer cette conversation'}
                    onPress={onUnlock}
                    loading={unlocking}
                    variant="accent"
                    size="lg"
                    fullWidth
                    icon={<Lock size={18} color={palette.white} strokeWidth={2.4} />}
                />
            ) : (
                <Button
                    title="Voir les abonnements"
                    onPress={onVoirAbonnements}
                    variant="accent"
                    size="lg"
                    fullWidth
                />
            )}

            {peutDebloquer && !parEssai && (
                <Text style={styles.hint}>
                    1 mise en relation sera décomptée de votre abonnement.
                </Text>
            )}

            <View style={styles.trustRow}>
                <ShieldCheck size={15} color={colors.textMuted} strokeWidth={2} />
                <Text style={styles.trustText}>
                    Paiement sécurisé · sans engagement · résiliable à tout moment
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing['2xl'],
        gap: spacing.md,
    },
    iconWrap: {
        width: 64,
        height: 64,
        borderRadius: radii.full,
        backgroundColor: palette.terracotta100,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xs,
    },
    title: {
        fontFamily: typography.heading,
        fontSize: fontSizes.xl,
        color: colors.text,
        textAlign: 'center',
    },
    previewCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.surfaceMuted,
        borderRadius: radii.lg,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        width: '100%',
    },
    previewText: {
        flex: 1,
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.base,
        color: colors.text,
        lineHeight: lineHeights.base,
    },
    subtitle: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: lineHeights.sm,
    },
    gateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginVertical: spacing.xs,
    },
    gateText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    hint: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        textAlign: 'center',
    },
    trustRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: spacing.sm,
    },
    trustText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },
});
