import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Share, ScrollView, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, UserPlus, Users, Trophy, Share2, Medal, Gift } from 'lucide-react-native';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../stores/auth';
import { suppressLock } from '../lib/lockGuard';
import { LoginInvite } from '../components/LoginInvite';
import { Skeleton, Button, Input } from '../components/ui';
import { colors, palette, spacing, typography, fontSizes, lineHeights, radii } from '../theme/tokens';

type Niveau = 'BRONZE' | 'ARGENT' | 'OR';

interface MyReferrals {
    filleuls: { id: string; prenom: string; statut: string; jours: number | null; inscritLe: string }[];
    filleulsAbonnes: number;
    totalJoursOfferts: number;
    niveau: Niveau | null;
    prochainPalier: { seuil: number; niveau: Niveau; restant: number } | null;
    paliers: { seuil: number; niveau: Niveau; bonusJours: number }[];
}

interface LeaderRow {
    rang: number;
    nom: string;
    niveau: Niveau | null;
    filleulsAbonnes: number;
}

const NIVEAU_META: Record<Niveau, { label: string; emoji: string; color: string }> = {
    BRONZE: { label: 'Bronze', emoji: '🥉', color: '#B45309' },
    ARGENT: { label: 'Argent', emoji: '🥈', color: '#64748B' },
    OR: { label: 'Or', emoji: '🥇', color: '#CA8A04' },
};

/** Hub Ambassadeur — parrainez, gagnez des jours d'abonnement et un statut. */
export default function RecompensesScreen() {
    const router = useRouter();
    const status = useAuth((s) => s.status);

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
                <Text style={styles.title}>Ambassadeur</Text>
                <View style={{ width: 38 }} />
            </View>

            {status !== 'authenticated' ? (
                <LoginInvite
                    title="Programme Ambassadeur"
                    message="Connectez-vous pour parrainer et gagner des jours d'abonnement offerts."
                />
            ) : (
                <AmbassadeurHub />
            )}
        </SafeAreaView>
    );
}

function AmbassadeurHub() {
    const { data, isLoading } = useQuery({
        queryKey: ['referral', 'mine'],
        queryFn: async () => {
            const { data } = await api.get<MyReferrals>('/referral/my-referrals');
            return data;
        },
    });

    return (
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
            <StatutCard data={data} loading={isLoading && !data} />
            <MonCodeCard />
            <ApplyReferralCard />
            <FilleulsSection data={data} />
            <Leaderboard />
            <Text style={styles.footerNote}>
                Comment ça marche : invitez un artisan avec votre code. Dès qu'il prend son premier
                abonnement, vous recevez tous les deux des jours d'abonnement offerts — et vous
                progressez vers les paliers Ambassadeur.
            </Text>
        </ScrollView>
    );
}

/** Bandeau statut : niveau + progression vers le prochain palier. */
function StatutCard({ data, loading }: { data?: MyReferrals; loading: boolean }) {
    if (loading) return <Skeleton height={120} borderRadius={radii.lg} />;

    const niveau = data?.niveau ?? null;
    const meta = niveau ? NIVEAU_META[niveau] : null;
    const prochain = data?.prochainPalier ?? null;
    const abonnes = data?.filleulsAbonnes ?? 0;
    const cible = prochain?.seuil ?? abonnes;
    const progress = cible > 0 ? Math.min(1, abonnes / cible) : 1;

    return (
        <View style={styles.statutCard}>
            <View style={styles.statutHead}>
                <View>
                    <Text style={styles.statutLabel}>Votre statut</Text>
                    <Text style={[styles.statutNiveau, meta ? { color: meta.color } : null]}>
                        {meta ? `${meta.emoji} Ambassadeur ${meta.label}` : 'Pas encore Ambassadeur'}
                    </Text>
                </View>
                <View style={styles.joursBadge}>
                    <Gift size={14} color={palette.green700} strokeWidth={2} />
                    <Text style={styles.joursBadgeTxt}>
                        {(data?.totalJoursOfferts ?? 0)} j offerts
                    </Text>
                </View>
            </View>

            <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.progressHint}>
                {prochain
                    ? `${abonnes}/${prochain.seuil} filleuls abonnés — plus que ${prochain.restant} pour le palier ${NIVEAU_META[prochain.niveau].label} !`
                    : `${abonnes} filleuls abonnés — palier maximum atteint 🎉`}
            </Text>
        </View>
    );
}

/** Mon code de parrainage + partage. */
function MonCodeCard() {
    const { data } = useQuery({
        queryKey: ['referral', 'my-code'],
        queryFn: async () => {
            const { data } = await api.get<{ code: string }>('/referral/my-code');
            return data;
        },
    });

    const partager = () => {
        if (!data?.code) return;
        suppressLock();
        void Share.share({
            message: `Rejoins AlloArtisan avec mon code parrain ${data.code} : on gagne chacun des jours d'abonnement offerts ! 🎁`,
        });
    };

    return (
        <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Mon code de parrainage</Text>
            <View style={styles.codeRow}>
                <Text style={styles.codeValue}>{data?.code ?? '········'}</Text>
                <Pressable
                    style={styles.shareBtn}
                    onPress={partager}
                    accessibilityRole="button"
                    accessibilityLabel="Partager mon code"
                >
                    <Share2 size={16} color={palette.white} strokeWidth={2} />
                    <Text style={styles.shareBtnTxt}>Partager</Text>
                </Pressable>
            </View>
        </View>
    );
}

/** Saisir le code d'un ami (dans les 30 jours suivant l'inscription). */
function ApplyReferralCard() {
    const qc = useQueryClient();
    const [code, setCode] = useState('');

    const apply = useMutation({
        mutationFn: async () => {
            await api.post('/referral/apply', { code: code.trim().toUpperCase() });
        },
        onSuccess: () => {
            Alert.alert(
                'Code appliqué ✅',
                'Le parrainage est enregistré. Vous gagnerez des jours d’abonnement offerts après votre premier abonnement.',
            );
            setCode('');
            void qc.invalidateQueries({ queryKey: ['referral', 'mine'] });
        },
        onError: (e) =>
            Alert.alert(
                'Code non appliqué',
                e instanceof ApiError ? e.message : 'Code invalide, déjà utilisé, ou délai dépassé.',
            ),
    });

    return (
        <View style={styles.card}>
            <View style={styles.cardHead}>
                <UserPlus size={18} color={colors.primary} strokeWidth={2} />
                <Text style={styles.cardTitle}>Un ami vous a parrainé ?</Text>
            </View>
            <Text style={styles.cardHint}>
                Saisissez son code (dans les 30 jours suivant votre inscription).
            </Text>
            <Input
                label="Code de parrainage"
                placeholder="CODE-PARRAIN"
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
            />
            <Button
                title="Appliquer le code"
                variant="secondary"
                fullWidth
                loading={apply.isPending}
                onPress={() => {
                    if (!code.trim()) {
                        Alert.alert('Code requis', 'Entrez le code de parrainage de votre ami.');
                        return;
                    }
                    apply.mutate();
                }}
            />
        </View>
    );
}

/** Liste des filleuls. */
function FilleulsSection({ data }: { data?: MyReferrals }) {
    if (!data || data.filleuls.length === 0) return null;

    return (
        <View style={styles.card}>
            <View style={styles.cardHead}>
                <Users size={18} color={colors.primary} strokeWidth={2} />
                <Text style={styles.cardTitle}>Mes filleuls ({data.filleuls.length})</Text>
            </View>
            {data.filleuls.map((f) => (
                <View key={f.id} style={styles.row}>
                    <Text style={styles.rowName}>{f.prenom}</Text>
                    <Text
                        style={[
                            styles.rowStatut,
                            f.statut === 'RECOMPENSE' && { color: palette.green700 },
                        ]}
                    >
                        {f.statut === 'RECOMPENSE'
                            ? `+${f.jours ?? 0} jours`
                            : 'En attente d’abonnement'}
                    </Text>
                </View>
            ))}
        </View>
    );
}

/** Classement des Ambassadeurs. */
function Leaderboard() {
    const { data } = useQuery({
        queryKey: ['referral', 'leaderboard'],
        queryFn: async () => {
            const { data } = await api.get<LeaderRow[]>('/referral/leaderboard');
            return data;
        },
        staleTime: 5 * 60 * 1000,
    });

    if (!data || data.length === 0) return null;

    return (
        <View style={styles.card}>
            <View style={styles.cardHead}>
                <Trophy size={18} color="#CA8A04" strokeWidth={2} />
                <Text style={styles.cardTitle}>Classement des Ambassadeurs</Text>
            </View>
            {data.map((row) => (
                <View key={row.rang} style={styles.row}>
                    <View style={styles.leaderLeft}>
                        <Text style={styles.leaderRang}>#{row.rang}</Text>
                        {row.niveau ? (
                            <Medal size={13} color={NIVEAU_META[row.niveau].color} strokeWidth={2} />
                        ) : null}
                        <Text style={styles.rowName} numberOfLines={1}>
                            {row.nom}
                        </Text>
                    </View>
                    <Text style={styles.leaderCount}>{row.filleulsAbonnes}</Text>
                </View>
            ))}
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
    list: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing['3xl'],
        gap: spacing.md,
    },
    // Statut
    statutCard: {
        backgroundColor: colors.primary,
        borderRadius: radii.lg,
        padding: spacing.lg,
        gap: spacing.sm,
    },
    statutHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    statutLabel: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: 'rgba(255,255,255,0.75)',
    },
    statutNiveau: {
        fontFamily: typography.heading,
        fontSize: fontSizes.lg,
        color: palette.white,
        marginTop: 2,
    },
    joursBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F0FDF4',
        paddingVertical: 4,
        paddingHorizontal: spacing.sm,
        borderRadius: radii.full,
    },
    joursBadgeTxt: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
        color: palette.green700,
    },
    progressTrack: {
        height: 8,
        borderRadius: radii.full,
        backgroundColor: 'rgba(255,255,255,0.25)',
        overflow: 'hidden',
        marginTop: spacing.xs,
    },
    progressFill: { height: 8, borderRadius: radii.full, backgroundColor: palette.white },
    progressHint: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        color: 'rgba(255,255,255,0.9)',
    },
    // Code
    codeCard: {
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.sm,
    },
    codeLabel: { fontFamily: typography.bodySemiBold, fontSize: fontSizes.sm, color: colors.text },
    codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    codeValue: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.lg,
        letterSpacing: 2,
        color: colors.primary,
    },
    shareBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.primary,
        paddingVertical: 8,
        paddingHorizontal: spacing.md,
        borderRadius: radii.full,
    },
    shareBtnTxt: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: palette.white,
    },
    // Cartes génériques
    card: {
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.sm,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    cardTitle: { fontFamily: typography.bodyBold, fontSize: fontSizes.base, color: colors.text },
    cardHint: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 3,
        color: colors.textSecondary,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 7,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    rowName: { fontFamily: typography.bodyMedium, fontSize: fontSizes.sm, color: colors.text, flexShrink: 1 },
    rowStatut: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },
    leaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
    leaderRang: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        width: 28,
    },
    leaderCount: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.sm,
        color: colors.primary,
    },
    footerNote: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 4,
        color: colors.textMuted,
        marginTop: spacing.sm,
    },
});
