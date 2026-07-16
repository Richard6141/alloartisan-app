import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ArrowLeft,
    Check,
    Crown,
    Gauge,
    Smartphone,
    Star,
    X,
    Zap,
} from 'lucide-react-native';
import { useAuth } from '../stores/auth';
import { LoginInvite } from '../components/LoginInvite';
import { Button, Card, Skeleton } from '../components/ui';
import {
    useSubscriptionPlans,
    useMySubscription,
    type SubscriptionPlan,
    type PlanPayant,
} from '../features/artisan/hooks';
import { colors, palette, spacing, typography, fontSizes, lineHeights, radii, shadows } from '../theme/tokens';

/**
 * Abonnement artisan — LE modèle économique : les clients ne paient rien,
 * les artisans paient un quota de mises en relation. Paiement Mobile Money
 * (KkiaPay) intégré : payer → valider sur son téléphone → palier actif.
 */

const ORDRE: Record<string, number> = { GRATUIT: 0, STANDARD: 1, PREMIUM: 2, GOLD: 3 };

/** Personnalité visuelle de chaque palier */
const PLAN_LOOK: Record<
    string,
    { icone: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; fg: string; bg: string }
> = {
    GRATUIT: { icone: Gauge, fg: palette.slate500, bg: palette.slate100 },
    STANDARD: { icone: Zap, fg: palette.navy700, bg: palette.navy50 },
    PREMIUM: { icone: Star, fg: '#B45309', bg: '#FEF3C7' },
    GOLD: { icone: Crown, fg: '#92400E', bg: '#FDE68A' },
};

export default function AbonnementScreen() {
    const router = useRouter();
    const isArtisan = useAuth((s) => s.status === 'authenticated' && s.user?.role === 'ARTISAN');

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.topBar}>
                <Pressable
                    onPress={() => router.back()}
                    hitSlop={12}
                    style={styles.backButton}
                    accessibilityRole="button"
                    accessibilityLabel="Retour"
                >
                    <ArrowLeft size={20} color={colors.text} strokeWidth={2.2} />
                </Pressable>
                <Text style={styles.title}>Mon abonnement</Text>
                <View style={{ width: 38 }} />
            </View>
            {!isArtisan ? (
                <LoginInvite
                    title="Espace artisan"
                    message="Connectez-vous avec un compte artisan pour gérer votre abonnement."
                />
            ) : (
                <AbonnementContent />
            )}
        </SafeAreaView>
    );
}

function AbonnementContent() {
    const router = useRouter();
    const { data: plans, isLoading: plansLoading, refetch: refetchPlans } = useSubscriptionPlans();
    const { data: mon, isLoading: monLoading, refetch: refetchMon } = useMySubscription();

    // Feuille de préparation : plan choisi → écran plein de paiement FedaPay
    const [planChoisi, setPlanChoisi] = useState<SubscriptionPlan | null>(null);

    // Au retour de l'écran de paiement, rafraîchir palier et quota
    useFocusEffect(
        React.useCallback(() => {
            void refetchMon();
            void refetchPlans();
        }, [refetchMon, refetchPlans]),
    );

    const lancerPaiement = () => {
        if (!planChoisi) return;
        const plan = planChoisi.type as PlanPayant;
        setPlanChoisi(null);
        // Écran PLEIN (pas un Modal) : le clavier redimensionne la WebView
        router.push({ pathname: '/paiement-abonnement', params: { plan } });
    };

    if ((plansLoading && !plans) || (monLoading && !mon)) {
        return (
            <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
                <Skeleton height={100} borderRadius={radii.lg} />
                <Skeleton height={90} borderRadius={radii.lg} />
                <Skeleton height={90} borderRadius={radii.lg} />
            </View>
        );
    }

    // Sur le palier GRATUIT, l'artisan n'a pas de quota mensuel (0) mais des
    // « essais découverte » one-shot : c'est CE compteur qu'il faut montrer,
    // sinon on affiche « 0/0 · Quota épuisé » alors qu'il a des essais offerts.
    const surGratuit = (mon?.plan ?? 'GRATUIT') === 'GRATUIT';
    const illimite = !surGratuit && mon?.quotaMensuel == null;
    const restant = surGratuit ? (mon?.essaisRestants ?? 0) : (mon?.demandesRestantes ?? 0);
    const total = surGratuit ? (mon?.essaisGratuits ?? 0) : (mon?.quotaMensuel ?? 0);
    const remplissage = total > 0 ? Math.min(1, Math.max(0, restant) / total) : 0;
    const quotaEpuise = !illimite && restant <= 0;
    const lookActuel = PLAN_LOOK[mon?.plan ?? 'GRATUIT'];
    const IconeActuel = lookActuel.icone;

    return (
        <>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Situation actuelle : une carte navy compacte qui pose le décor */}
                <LinearGradient
                    colors={[palette.navy800, palette.navy900]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.currentCard}
                >
                    <View style={styles.currentRow}>
                        <View style={[styles.currentIcon, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
                            <IconeActuel size={17} color={palette.white} strokeWidth={2.2} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.currentPlan} numberOfLines={1}>
                                Palier {mon?.plan}
                            </Text>
                            <Text style={styles.currentMeta} numberOfLines={1}>
                                {mon?.expireAt
                                    ? `${mon.expireBientot ? '⚠️ Expire' : "Jusqu'au"} ${new Date(mon.expireAt).toLocaleDateString('fr-FR')}`
                                    : 'Sans engagement'}
                            </Text>
                        </View>
                        <Text style={styles.currentQuota}>
                            {illimite ? '∞' : `${Math.max(0, restant)}/${total}`}
                        </Text>
                    </View>
                    {!illimite && total > 0 && (
                        <View style={styles.quotaTrack}>
                            <View
                                style={[
                                    styles.quotaFill,
                                    { width: `${Math.round(remplissage * 100)}%` },
                                    quotaEpuise && { backgroundColor: palette.red600 },
                                ]}
                            />
                        </View>
                    )}
                    <Text style={styles.currentHint} numberOfLines={2}>
                        {quotaEpuise
                            ? surGratuit
                                ? 'Vos mises en relation découverte sont épuisées. Passez à un palier pour continuer à recevoir des clients.'
                                : 'Quota épuisé ce mois-ci. Passez à un palier supérieur pour recevoir plus de clients.'
                            : surGratuit
                              ? `Il vous reste ${Math.max(0, restant)} mise(s) en relation découverte offerte(s). Les clients ne paient jamais rien.`
                              : 'Mises en relation restantes ce mois. Les clients ne paient jamais rien.'}
                    </Text>
                </LinearGradient>

                {/* Les paliers, compacts, GOLD mis en scène */}
                {(plans ?? []).map((plan) => {
                    const actuel = plan.type === mon?.plan;
                    const superieur = ORDRE[plan.type] > ORDRE[mon?.plan ?? 'GRATUIT'];
                    const gold = plan.type === 'GOLD';
                    const look = PLAN_LOOK[plan.type];
                    const Icone = look.icone;
                    return (
                        <Pressable
                            key={plan.type}
                            onPress={superieur ? () => setPlanChoisi(plan) : undefined}
                            disabled={!superieur}
                            accessibilityRole={superieur ? 'button' : undefined}
                            style={({ pressed }) => [
                                styles.planCard,
                                actuel && styles.planCardActuel,
                                gold && styles.planCardGold,
                                pressed && superieur && { transform: [{ scale: 0.99 }] },
                            ]}
                        >
                            <View style={[styles.planIcon, { backgroundColor: look.bg }]}>
                                <Icone size={17} color={look.fg} strokeWidth={2.2} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <View style={styles.planNomRow}>
                                    <Text style={[styles.planNom, gold && { color: '#92400E' }]}>
                                        {plan.type}
                                    </Text>
                                    {actuel && (
                                        <View style={styles.actuelBadge}>
                                            <Text style={styles.actuelBadgeText}>Actuel</Text>
                                        </View>
                                    )}
                                    {gold && !actuel && (
                                        <View style={[styles.actuelBadge, { backgroundColor: '#FDE68A' }]}>
                                            <Text style={[styles.actuelBadgeText, { color: '#92400E' }]}>
                                                Illimité
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.planMissions} numberOfLines={1}>
                                    {plan.type === 'GRATUIT'
                                        ? `${mon?.essaisGratuits ?? 3} mises en relation offertes`
                                        : plan.demandesMois == null
                                          ? 'Mises en relation illimitées'
                                          : `${plan.demandesMois} mises en relation / mois`}
                                </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={[styles.planPrix, gold && { color: '#92400E' }]}>
                                    {plan.prix === 0
                                        ? 'Gratuit'
                                        : `${plan.prix.toLocaleString('fr-FR')} F CFA`}
                                </Text>
                                {plan.prix > 0 && <Text style={styles.planPrixUnit}>par mois</Text>}
                            </View>
                        </Pressable>
                    );
                })}

                <Text style={styles.footNote}>
                    Une « mise en relation » = une demande de client reçue. Touchez un palier
                    supérieur pour l'activer par Mobile Money (MTN ou Moov).
                </Text>
            </ScrollView>

            {/* Feuille de préparation du paiement */}
            <Modal
                visible={planChoisi != null}
                transparent
                animationType="slide"
                onRequestClose={() => setPlanChoisi(null)}
            >
                <View style={styles.sheetBackdrop}>
                    <View style={styles.sheet}>
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>
                                Palier {planChoisi?.type} ·{' '}
                                {planChoisi?.prix.toLocaleString('fr-FR')} F CFA
                            </Text>
                            <Pressable
                                onPress={() => setPlanChoisi(null)}
                                hitSlop={10}
                                accessibilityLabel="Fermer"
                            >
                                <X size={20} color={colors.text} strokeWidth={2.2} />
                            </Pressable>
                        </View>

                        <View style={{ gap: spacing.xs }}>
                            {(planChoisi?.avantages ?? []).map((a) => (
                                <View key={a} style={styles.avantageRow}>
                                    <Check size={13} color={palette.green600} strokeWidth={2.6} />
                                    <Text style={styles.avantageText}>{a}</Text>
                                </View>
                            ))}
                        </View>
                        <Text style={styles.payerNote}>
                            Paiement sécurisé par FedaPay, sans quitter l'application : Mobile
                            Money (MTN, Moov) ou carte bancaire.
                        </Text>
                        <Button
                            title={`Payer ${planChoisi?.prix.toLocaleString('fr-FR')} F CFA`}
                            size="lg"
                            fullWidth
                            icon={<Smartphone size={16} color={colors.onPrimary} strokeWidth={2.2} />}
                            onPress={lancerPaiement}
                        />
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
    },
    backButton: {
        width: 38,
        height: 38,
        borderRadius: radii.full,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    title: {
        flex: 1,
        textAlign: 'center',
        fontFamily: typography.heading,
        fontSize: fontSizes.lg,
        color: colors.text,
        letterSpacing: -0.3,
    },
    content: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing['3xl'],
        gap: spacing.md,
    },

    // ─── Situation actuelle ──────────────────────────────────────────────────
    currentCard: {
        borderRadius: radii.lg,
        padding: spacing.md,
        gap: spacing.sm,
        ...shadows.card,
    },
    currentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    currentIcon: {
        width: 34,
        height: 34,
        borderRadius: radii.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    currentPlan: {
        fontFamily: typography.heading,
        fontSize: fontSizes.base,
        color: palette.white,
        letterSpacing: 0.2,
    },
    currentMeta: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: 'rgba(255,255,255,0.72)',
        marginTop: 1,
    },
    currentQuota: {
        fontFamily: typography.heading,
        fontSize: fontSizes.lg,
        color: palette.white,
        letterSpacing: -0.3,
    },
    quotaTrack: {
        height: 5,
        borderRadius: radii.full,
        backgroundColor: 'rgba(255,255,255,0.18)',
        overflow: 'hidden',
    },
    quotaFill: {
        height: '100%',
        borderRadius: radii.full,
        backgroundColor: '#4ADE80',
    },
    currentHint: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs - 1,
        lineHeight: lineHeights.xs,
        color: 'rgba(255,255,255,0.65)',
    },

    // ─── Paliers ─────────────────────────────────────────────────────────────
    planCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        ...shadows.card,
    },
    planCardActuel: {
        borderColor: colors.primary,
        borderWidth: 1.5,
    },
    planCardGold: {
        borderColor: '#F59E0B',
        borderWidth: 1.5,
        backgroundColor: '#FFFDF5',
    },
    planIcon: {
        width: 38,
        height: 38,
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    planNomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    planNom: {
        fontFamily: typography.heading,
        fontSize: fontSizes.sm,
        color: colors.text,
        letterSpacing: 0.4,
    },
    actuelBadge: {
        backgroundColor: colors.primarySoft,
        borderRadius: radii.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
    },
    actuelBadgeText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs - 2,
        color: colors.primary,
    },
    planMissions: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: 1,
    },
    planPrix: {
        fontFamily: typography.heading,
        fontSize: fontSizes.sm,
        color: colors.text,
        letterSpacing: -0.2,
    },
    planPrixUnit: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs - 1,
        color: colors.textMuted,
    },
    avantageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    avantageText: {
        flex: 1,
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    payerNote: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 3,
        color: colors.textMuted,
    },
    footNote: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 4,
        color: colors.textMuted,
    },

    // ─── Feuille de paiement ─────────────────────────────────────────────────
    sheetBackdrop: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        padding: spacing.xl,
        paddingBottom: spacing['2xl'],
        gap: spacing.lg,
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
    },
    sheetTitle: {
        flex: 1,
        fontFamily: typography.heading,
        fontSize: fontSizes.md,
        color: colors.text,
    },
    attenteBox: {
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.primarySoft,
        borderRadius: radii.lg,
        padding: spacing.lg,
    },
    attenteTitre: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.base,
        color: colors.text,
    },
    attenteText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 4,
        color: colors.textSecondary,
        textAlign: 'center',
    },
});
