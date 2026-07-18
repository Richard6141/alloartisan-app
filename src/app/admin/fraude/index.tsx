import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, RefreshControl } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShieldAlert, ShieldCheck, ChevronRight, Radar, MapPin } from 'lucide-react-native';
import { api, ApiError } from '../../../lib/api';
import { useAuth } from '../../../stores/auth';
import { Card, Button, EmptyState, Skeleton } from '../../../components/ui';
import {
    NIVEAU_META,
    scoreColor,
    type FraudNiveau,
} from '../../../features/admin/fraud';
import { colors, spacing, typography, fontSizes, lineHeights, radii } from '../../../theme/tokens';

interface HighRiskRow {
    artisanId: string;
    nom: string;
    ville: string | null;
    score: number;
    niveau: FraudNiveau;
}

export default function FraudeDashboardScreen() {
    const router = useRouter();
    const isAdmin = useAuth((s) => s.status === 'authenticated' && s.user?.role === 'ADMIN');

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
                <Text style={styles.title}>Anti-fraude</Text>
                <View style={{ width: 38 }} />
            </View>
            {!isAdmin ? (
                <EmptyState
                    icon={<ShieldAlert size={30} color={colors.textMuted} strokeWidth={1.6} />}
                    title="Accès réservé"
                    message="Cet espace est réservé aux administrateurs de la plateforme."
                />
            ) : (
                <Content />
            )}
        </SafeAreaView>
    );
}

function Content() {
    const router = useRouter();
    const qc = useQueryClient();

    const { data, isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['admin', 'fraud', 'high-risk'],
        queryFn: async () => {
            const { data } = await api.get<HighRiskRow[]>('/admin/fraud/high-risk');
            return data;
        },
    });

    const scan = useMutation({
        mutationFn: async () => {
            const { data } = await api.get<{ total: number; blocked: number; flagged: number }>(
                '/admin/fraud/scan',
            );
            return data;
        },
        onSuccess: (r) => {
            void qc.invalidateQueries({ queryKey: ['admin', 'fraud', 'high-risk'] });
            Alert.alert(
                'Scan terminé',
                `${r.total} artisan${r.total > 1 ? 's' : ''} analysé${r.total > 1 ? 's' : ''}\n` +
                    `${r.blocked} bloqué${r.blocked > 1 ? 's' : ''} · ${r.flagged} signalé${r.flagged > 1 ? 's' : ''}`,
            );
        },
        onError: (e) =>
            Alert.alert('Scan impossible', e instanceof ApiError ? e.message : 'Réessayez.'),
    });

    return (
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
            <Card style={styles.scanCard}>
                <View style={styles.scanIcon}>
                    <Radar size={20} color={colors.primary} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.scanTitle}>Scan de fraude</Text>
                    <Text style={styles.scanText}>
                        Recalcule les scores et applique les actions (blocage temporaire, signalement).
                    </Text>
                </View>
            </Card>
            <Button
                title="Lancer un scan complet"
                fullWidth
                loading={scan.isPending}
                onPress={() => scan.mutate()}
            />

            <Text style={styles.sectionTitle}>Artisans à haut risque</Text>

            {isLoading && !data ? (
                <View style={{ gap: spacing.md }}>
                    <Skeleton height={72} borderRadius={radii.lg} />
                    <Skeleton height={72} borderRadius={radii.lg} />
                </View>
            ) : !data || data.length === 0 ? (
                <EmptyState
                    icon={<ShieldCheck size={30} color={colors.success} strokeWidth={1.6} />}
                    title="Rien à signaler"
                    message="Aucun artisan au-dessus du seuil de risque pour le moment."
                />
            ) : (
                <View style={{ gap: spacing.md }}>
                    {data.map((row) => {
                        const meta = NIVEAU_META[row.niveau];
                        return (
                            <Pressable
                                key={row.artisanId}
                                onPress={() =>
                                    router.push({
                                        pathname: '/admin/fraude/[artisanId]',
                                        params: { artisanId: row.artisanId, nom: row.nom },
                                    })
                                }
                                accessibilityRole="button"
                            >
                                <Card style={styles.riskCard}>
                                    <View style={[styles.scoreBadge, { backgroundColor: scoreColor(row.score) }]}>
                                        <Text style={styles.scoreValue}>{row.score}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.riskName} numberOfLines={1}>
                                            {row.nom}
                                        </Text>
                                        <View style={styles.riskMetaRow}>
                                            <Text style={[styles.riskNiveau, { color: meta.color }]}>
                                                {meta.label}
                                            </Text>
                                            {row.ville ? (
                                                <View style={styles.villeRow}>
                                                    <MapPin size={11} color={colors.textMuted} strokeWidth={2} />
                                                    <Text style={styles.villeTxt} numberOfLines={1}>
                                                        {row.ville}
                                                    </Text>
                                                </View>
                                            ) : null}
                                        </View>
                                    </View>
                                    <ChevronRight size={18} color={colors.textMuted} strokeWidth={2.2} />
                                </Card>
                            </Pressable>
                        );
                    })}
                </View>
            )}
        </ScrollView>
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
    scanCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    scanIcon: {
        width: 40,
        height: 40,
        borderRadius: radii.full,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scanTitle: { fontFamily: typography.bodyBold, fontSize: fontSizes.base, color: colors.text },
    scanText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 3,
        color: colors.textSecondary,
        marginTop: 1,
    },
    sectionTitle: {
        fontFamily: typography.heading,
        fontSize: fontSizes.base,
        color: colors.text,
        marginTop: spacing.sm,
    },
    riskCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    scoreBadge: {
        width: 44,
        height: 44,
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scoreValue: {
        fontFamily: typography.heading,
        fontSize: fontSizes.lg,
        color: '#FFFFFF',
    },
    riskName: { fontFamily: typography.bodyBold, fontSize: fontSizes.base, color: colors.text },
    riskMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
    riskNiveau: { fontFamily: typography.bodySemiBold, fontSize: fontSizes.xs },
    villeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
    villeTxt: { fontFamily: typography.body, fontSize: fontSizes.xs, color: colors.textMuted, flexShrink: 1 },
});
