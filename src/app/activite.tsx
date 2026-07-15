import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    Star,
    Wallet,
    CalendarDays,
    Gauge,
    ChevronRight,
    Clock4,
    Images,
    Rocket,
    ShieldCheck,
    UserRoundCog,
    XCircle,
} from 'lucide-react-native';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../stores/auth';
import { LoginInvite } from '../components/LoginInvite';
import { Card, Skeleton } from '../components/ui';
import { useMyArtisanProfile } from '../features/artisan/hooks';
import { colors, palette, spacing, typography, fontSizes, lineHeights, radii } from '../theme/tokens';

interface ArtisanStats {
    parStatut: Record<string, number>;
    moisCourant: number;
    moisPrecedent: number;
    evolution: number | null;
    noteMoyenne: number;
    nombreAvis: number;
    tauxCompletion: number;
    revenuTotal: number;
    quotaRestant: number | null;
}

/** Tableau de bord de l'artisan : disponibilité + chiffres clés */
export default function ActiviteScreen() {
    const router = useRouter();
    const status = useAuth((s) => s.status);
    const isArtisan = useAuth((s) => s.user?.role === 'ARTISAN');

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
                <Text style={styles.title}>Mon activité</Text>
                <View style={{ width: 38 }} />
            </View>

            {status !== 'authenticated' || !isArtisan ? (
                <LoginInvite
                    title="Espace artisan"
                    message="Connectez-vous avec un compte artisan pour suivre votre activité."
                />
            ) : (
                <ActivityContent />
            )}
        </SafeAreaView>
    );
}

function ActivityContent() {
    const queryClient = useQueryClient();
    const router = useRouter();

    const { data: stats, isLoading } = useQuery({
        queryKey: ['artisan', 'stats'],
        queryFn: async () => {
            const { data } = await api.get<ArtisanStats>('/bookings/stats');
            return data;
        },
        refetchInterval: 60000,
    });

    const { data: me } = useMyArtisanProfile();

    const toggleDispo = useMutation({
        mutationFn: async (disponible: boolean) => {
            await api.patch('/artisans/me/disponibilite', { disponible });
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['artisan', 'me'] });
        },
        onError: (e) =>
            Alert.alert('Changement impossible', e instanceof ApiError ? e.message : 'Réessayez.'),
    });

    if (isLoading && !stats) {
        return (
            <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
                <Skeleton height={72} borderRadius={radii.lg} />
                <Skeleton height={110} borderRadius={radii.lg} />
                <Skeleton height={110} borderRadius={radii.lg} />
            </View>
        );
    }

    const enAttente = stats?.parStatut?.SOUMISE ?? 0;
    const enCours =
        (stats?.parStatut?.CONFIRMEE ?? 0) + (stats?.parStatut?.EN_COURS ?? 0);
    const terminees = stats?.parStatut?.TERMINEE ?? 0;
    const evolutionPositive = (stats?.evolution ?? 0) >= 0;

    return (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Cycle de validation du profil */}
            {me?.statut === 'EN_ATTENTE' && (
                <Pressable onPress={() => router.push('/justificatifs')} accessibilityRole="button">
                    <Card style={[styles.verifyCard, { backgroundColor: colors.warningSoft }]}>
                        <Clock4 size={20} color={palette.terracotta700} strokeWidth={2.2} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.verifyTitle, { color: palette.terracotta700 }]}>
                                Profil en attente de validation
                            </Text>
                            <Text style={styles.verifyText}>
                                Vous n'êtes pas encore visible des clients. Ajoutez vos
                                justificatifs pour accélérer la vérification.
                            </Text>
                        </View>
                        <ChevronRight size={18} color={palette.terracotta700} strokeWidth={2.2} />
                    </Card>
                </Pressable>
            )}
            {me?.statut === 'REJETE' && (
                <Pressable onPress={() => router.push('/justificatifs')} accessibilityRole="button">
                    <Card style={[styles.verifyCard, { backgroundColor: colors.dangerSoft }]}>
                        <XCircle size={20} color={palette.red700} strokeWidth={2.2} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.verifyTitle, { color: palette.red700 }]}>
                                Profil refusé
                            </Text>
                            <Text style={styles.verifyText}>
                                Ajoutez des justificatifs valides pour un nouvel examen.
                            </Text>
                        </View>
                        <ChevronRight size={18} color={palette.red700} strokeWidth={2.2} />
                    </Card>
                </Pressable>
            )}

            {/* Disponibilité */}
            <Card style={styles.dispoCard}>
                <View
                    style={[
                        styles.dispoDot,
                        {
                            backgroundColor: me?.disponible
                                ? palette.green600
                                : palette.slate300,
                        },
                    ]}
                />
                <View style={{ flex: 1 }}>
                    <Text style={styles.dispoTitle}>
                        {me?.disponible ? 'Vous êtes disponible' : 'Vous êtes indisponible'}
                    </Text>
                    <Text style={styles.dispoText}>
                        {me?.disponible
                            ? 'Les clients peuvent vous envoyer des demandes'
                            : 'Vous n\'apparaissez plus comme disponible dans la recherche'}
                    </Text>
                </View>
                <Switch
                    value={me?.disponible ?? true}
                    onValueChange={(v) => toggleDispo.mutate(v)}
                    trackColor={{ true: palette.green600, false: colors.border }}
                    thumbColor={colors.surface}
                />
            </Card>

            {/* Revenus */}
            <Card style={styles.revenueCard}>
                <View style={styles.revenueIcon}>
                    <Wallet size={20} color="#047857" strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.revenueLabel}>Revenus totaux (payés en ligne)</Text>
                    <Text style={styles.revenueValue}>
                        {Number(stats?.revenuTotal ?? 0).toLocaleString('fr-FR')} FCFA
                    </Text>
                </View>
            </Card>

            {/* Ce mois-ci */}
            <View style={styles.row}>
                <Card style={styles.statCard}>
                    <CalendarDays size={17} color={colors.primary} strokeWidth={2} />
                    <Text style={styles.statValue}>{stats?.moisCourant ?? 0}</Text>
                    <Text style={styles.statLabel}>demandes ce mois</Text>
                    {stats?.evolution != null && (
                        <View style={styles.evolution}>
                            {evolutionPositive ? (
                                <TrendingUp size={12} color={palette.green600} strokeWidth={2.4} />
                            ) : (
                                <TrendingDown size={12} color={palette.red600} strokeWidth={2.4} />
                            )}
                            <Text
                                style={[
                                    styles.evolutionText,
                                    {
                                        color: evolutionPositive
                                            ? palette.green700
                                            : palette.red700,
                                    },
                                ]}
                            >
                                {evolutionPositive ? '+' : ''}
                                {stats.evolution}% vs mois dernier
                            </Text>
                        </View>
                    )}
                </Card>
                <Card style={styles.statCard}>
                    <Star size={17} color="#F59E0B" fill="#F59E0B" strokeWidth={0} />
                    <Text style={styles.statValue}>
                        {Number(stats?.noteMoyenne ?? 0).toFixed(1)}
                    </Text>
                    <Text style={styles.statLabel}>{stats?.nombreAvis ?? 0} avis clients</Text>
                </Card>
            </View>

            {/* Pipeline */}
            <Card style={{ gap: spacing.md }}>
                <Text style={styles.sectionTitle}>Mes missions</Text>
                <PipelineRow label="En attente de réponse" value={enAttente} tone={palette.amber600} />
                <PipelineRow label="Confirmées / en cours" value={enCours} tone={colors.primary} />
                <PipelineRow label="Terminées" value={terminees} tone={palette.green600} />
            </Card>

            {/* Quota épuisé ou presque : pousser à l'upgrade */}
            {stats?.quotaRestant != null && stats.quotaRestant <= 1 && (
                <Pressable onPress={() => router.push('/abonnement')} accessibilityRole="button">
                    <Card
                        style={[
                            styles.verifyCard,
                            {
                                backgroundColor:
                                    stats.quotaRestant === 0
                                        ? colors.dangerSoft
                                        : colors.warningSoft,
                            },
                        ]}
                    >
                        <Gauge
                            size={20}
                            color={
                                stats.quotaRestant === 0 ? palette.red700 : palette.terracotta700
                            }
                            strokeWidth={2.2}
                        />
                        <View style={{ flex: 1 }}>
                            <Text
                                style={[
                                    styles.verifyTitle,
                                    {
                                        color:
                                            stats.quotaRestant === 0
                                                ? palette.red700
                                                : palette.terracotta700,
                                    },
                                ]}
                            >
                                {stats.quotaRestant === 0
                                    ? 'Quota du mois épuisé'
                                    : 'Plus qu’une mise en relation ce mois'}
                            </Text>
                            <Text style={styles.verifyText}>
                                {stats.quotaRestant === 0
                                    ? 'Les clients ne peuvent plus vous contacter. Passez au palier supérieur pour continuer à recevoir des demandes.'
                                    : 'Passez à un palier supérieur pour continuer à recevoir des demandes sans interruption.'}
                            </Text>
                        </View>
                        <ChevronRight
                            size={18}
                            color={
                                stats.quotaRestant === 0 ? palette.red700 : palette.terracotta700
                            }
                            strokeWidth={2.2}
                        />
                    </Card>
                </Pressable>
            )}

            {/* Quota + complétion */}
            <View style={styles.row}>
                <Pressable
                    onPress={() => router.push('/abonnement')}
                    accessibilityRole="button"
                    style={{ flex: 1 }}
                >
                    <Card style={[styles.statCard, { flex: undefined }]}>
                        <Gauge size={17} color={colors.accent} strokeWidth={2} />
                        <Text style={styles.statValue}>
                            {stats?.quotaRestant == null ? '∞' : stats.quotaRestant}
                        </Text>
                        <Text style={styles.statLabel}>
                            demandes restantes · gérer mon abonnement
                        </Text>
                    </Card>
                </Pressable>
                <Card style={styles.statCard}>
                    <TrendingUp size={17} color={colors.primary} strokeWidth={2} />
                    <Text style={styles.statValue}>
                        {Number(stats?.tauxCompletion ?? 0).toFixed(0)}%
                    </Text>
                    <Text style={styles.statLabel}>taux de complétion</Text>
                </Card>
            </View>

            {/* Espace pro */}
            <Card style={{ gap: 0, paddingVertical: spacing.xs }}>
                <Text style={[styles.sectionTitle, { paddingVertical: spacing.sm }]}>
                    Mon espace pro
                </Text>
                {!me?.verified && (
                    <ProRow
                        icon={<Rocket size={18} color={colors.accent} strokeWidth={2} />}
                        title="Bien démarrer"
                        subtitle="Les étapes pour rendre votre profil visible"
                        onPress={() => router.push('/artisan-demarrage')}
                    />
                )}
                <ProRow
                    icon={<UserRoundCog size={18} color={colors.primary} strokeWidth={2} />}
                    title="Profil professionnel"
                    subtitle="Zone d'intervention, métiers, horaires"
                    onPress={() => router.push('/profil-pro')}
                />
                <ProRow
                    icon={
                        <ShieldCheck
                            size={18}
                            color={me?.verified ? palette.green600 : colors.primary}
                            strokeWidth={2}
                        />
                    }
                    title="Justificatifs et vérification"
                    subtitle={
                        me?.verified
                            ? 'Profil vérifié ✓'
                            : 'Diplômes, carte professionnelle, attestations'
                    }
                    onPress={() => router.push('/justificatifs')}
                />
                <ProRow
                    icon={<Images size={18} color={colors.primary} strokeWidth={2} />}
                    title="Mes réalisations"
                    subtitle="Photos de chantiers visibles sur votre fiche"
                    onPress={() => router.push('/mes-realisations')}
                />
                <ProRow
                    icon={<Gauge size={18} color={colors.accent} strokeWidth={2} />}
                    title="Mon abonnement"
                    subtitle="Palier, quota de mises en relation, avantages"
                    onPress={() => router.push('/abonnement')}
                    last
                />
            </Card>
        </ScrollView>
    );
}

function ProRow({
    icon,
    title,
    subtitle,
    onPress,
    last,
}: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    onPress: () => void;
    last?: boolean;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={[styles.proRow, !last && styles.proRowBorder]}
            accessibilityRole="button"
        >
            <View style={styles.proRowIcon}>{icon}</View>
            <View style={{ flex: 1 }}>
                <Text style={styles.proRowTitle}>{title}</Text>
                <Text style={styles.proRowSubtitle} numberOfLines={1}>
                    {subtitle}
                </Text>
            </View>
            <ChevronRight size={17} color={colors.textMuted} strokeWidth={2.2} />
        </Pressable>
    );
}

function PipelineRow({ label, value, tone }: { label: string; value: number; tone: string }) {
    return (
        <View style={styles.pipelineRow}>
            <View style={[styles.pipelineDot, { backgroundColor: tone }]} />
            <Text style={styles.pipelineLabel}>{label}</Text>
            <Text style={styles.pipelineValue}>{value}</Text>
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
    dispoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    dispoDot: {
        width: 12,
        height: 12,
        borderRadius: radii.full,
    },
    dispoTitle: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.base,
        color: colors.text,
    },
    dispoText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 3,
        color: colors.textSecondary,
        marginTop: 1,
    },
    revenueCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    revenueIcon: {
        width: 42,
        height: 42,
        borderRadius: radii.full,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    revenueLabel: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
    revenueValue: {
        fontFamily: typography.heading,
        fontSize: fontSizes.xl,
        color: '#047857',
        letterSpacing: -0.4,
        marginTop: 1,
    },
    row: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    statCard: {
        flex: 1,
        gap: spacing.xs,
    },
    statValue: {
        fontFamily: typography.heading,
        fontSize: fontSizes.xl,
        color: colors.text,
        letterSpacing: -0.4,
    },
    statLabel: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
    evolution: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    evolutionText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs - 1,
    },
    sectionTitle: {
        fontFamily: typography.heading,
        fontSize: fontSizes.base,
        color: colors.text,
    },
    pipelineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    pipelineDot: {
        width: 9,
        height: 9,
        borderRadius: radii.full,
    },
    pipelineLabel: {
        flex: 1,
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    pipelineValue: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.md,
        color: colors.text,
    },
    verifyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderWidth: 0,
    },
    verifyTitle: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.sm,
    },
    verifyText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 3,
        color: colors.textSecondary,
        marginTop: 1,
    },
    proRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
    },
    proRowBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    proRowIcon: {
        width: 36,
        height: 36,
        borderRadius: radii.full,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    proRowTitle: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    proRowSubtitle: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: 1,
    },
});
