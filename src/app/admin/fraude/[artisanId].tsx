import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AlertTriangle } from 'lucide-react-native';
import { api } from '../../../lib/api';
import { Card, Skeleton, EmptyState } from '../../../components/ui';
import {
    NIVEAU_META,
    ACTION_LABEL,
    scoreColor,
    type FraudScore,
} from '../../../features/admin/fraud';
import { colors, spacing, typography, fontSizes, lineHeights, radii } from '../../../theme/tokens';

export default function FraudeDetailScreen() {
    const router = useRouter();
    const { artisanId, nom } = useLocalSearchParams<{ artisanId: string; nom?: string }>();

    const { data, isLoading, isError } = useQuery({
        queryKey: ['admin', 'fraud', 'artisan', artisanId],
        queryFn: async () => {
            const { data } = await api.get<FraudScore>(`/admin/fraud/artisans/${artisanId}`);
            return data;
        },
        enabled: !!artisanId,
    });

    const meta = data ? NIVEAU_META[data.niveau] : null;

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
                <Text style={styles.title} numberOfLines={1}>
                    {nom || 'Artisan'}
                </Text>
                <View style={{ width: 38 }} />
            </View>

            {isLoading && !data ? (
                <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
                    <Skeleton height={130} borderRadius={radii.lg} />
                    <Skeleton height={220} borderRadius={radii.lg} />
                </View>
            ) : !data || isError ? (
                <EmptyState
                    icon={<AlertTriangle size={30} color={colors.textMuted} strokeWidth={1.6} />}
                    title="Score indisponible"
                    message="Impossible de calculer le score de cet artisan pour le moment."
                />
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Score + niveau + action */}
                    <Card style={styles.scoreCard}>
                        <View style={[styles.scoreBadge, { backgroundColor: scoreColor(data.score) }]}>
                            <Text style={styles.scoreValue}>{data.score}</Text>
                            <Text style={styles.scoreMax}>/100</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.niveau, meta ? { color: meta.color } : null]}>
                                {meta?.label}
                            </Text>
                            <Text style={styles.action}>{ACTION_LABEL[data.action]}</Text>
                        </View>
                    </Card>

                    <Text style={styles.sectionTitle}>Signaux détectés</Text>
                    <Card style={{ gap: 0 }}>
                        <SignalRow
                            label="Taux d’annulation"
                            value={`${data.signaux.tauxAnnulation} %`}
                            triggered={data.signaux.tauxAnnulation >= 50}
                            hint="Seuil : 50 %"
                        />
                        <SignalRow
                            label="Avis négatifs répétés"
                            value={`${data.signaux.mauvaisAvisRepetes} avis < 2★`}
                            triggered={data.signaux.mauvaisAvisRepetes >= 3}
                            hint="Seuil : 3 avis"
                        />
                        <SignalRow
                            label="Nouveau compte + grosse transaction"
                            value={data.signaux.nouveauCompteGrosseMise ? 'Oui' : 'Non'}
                            triggered={data.signaux.nouveauCompteGrosseMise}
                            hint="< 7 j & > 200 000 FCFA"
                        />
                        <SignalRow
                            label="Afflux de demandes (flooding)"
                            value={data.signaux.floodingDemandes ? 'Oui' : 'Non'}
                            triggered={data.signaux.floodingDemandes}
                            hint="> 10 demandes / heure"
                        />
                        <SignalRow
                            label="Profil non vérifié actif"
                            value={`${data.signaux.profilNonVerifieActif} demandes`}
                            triggered={data.signaux.profilNonVerifieActif >= 5}
                            hint="Seuil : 5 demandes"
                            last
                        />
                    </Card>

                    <Text style={styles.calcNote}>
                        Score recalculé à la demande (cache 5 min). Le blocage/signalement
                        automatique s’applique lors du scan.
                    </Text>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

function SignalRow({
    label,
    value,
    triggered,
    hint,
    last,
}: {
    label: string;
    value: string;
    triggered: boolean;
    hint: string;
    last?: boolean;
}) {
    return (
        <View style={[styles.signalRow, last && { borderBottomWidth: 0 }]}>
            <View
                style={[
                    styles.dot,
                    { backgroundColor: triggered ? colors.danger : colors.border },
                ]}
            />
            <View style={{ flex: 1 }}>
                <Text style={[styles.signalLabel, triggered && { color: colors.text }]}>
                    {label}
                </Text>
                <Text style={styles.signalHint}>{hint}</Text>
            </View>
            <Text style={[styles.signalValue, triggered && { color: colors.danger }]}>
                {value}
            </Text>
        </View>
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
    scoreCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg,
    },
    scoreBadge: {
        width: 72,
        height: 72,
        borderRadius: radii.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scoreValue: {
        fontFamily: typography.heading,
        fontSize: fontSizes['2xl'],
        color: '#FFFFFF',
    },
    scoreMax: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: 'rgba(255,255,255,0.85)',
        marginTop: -2,
    },
    niveau: {
        fontFamily: typography.heading,
        fontSize: fontSizes.lg,
    },
    action: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        marginTop: 2,
    },
    sectionTitle: {
        fontFamily: typography.heading,
        fontSize: fontSizes.base,
        color: colors.text,
        marginTop: spacing.sm,
    },
    signalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    dot: { width: 10, height: 10, borderRadius: radii.full },
    signalLabel: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    signalHint: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        marginTop: 1,
    },
    signalValue: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    calcNote: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 4,
        color: colors.textMuted,
        marginTop: spacing.sm,
    },
});
