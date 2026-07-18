import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft,
    BadgeCheck,
    CalendarDays,
    ChevronRight,
    FileSearch,
    LockOpen,
    ShieldAlert,
    Star,
    Users,
    Wallet,
} from 'lucide-react-native';
import { useAuth } from '../../stores/auth';
import { Card, EmptyState, Skeleton } from '../../components/ui';
import {
    useAdminOverview,
    usePendingArtisans,
    usePendingCertifications,
} from '../../features/admin/hooks';
import { colors, palette, spacing, typography, fontSizes, lineHeights, radii } from '../../theme/tokens';

/** Tableau de bord administrateur : KPI plateforme + files de validation */
export default function AdminScreen() {
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
                <Text style={styles.title}>Administration</Text>
                <View style={{ width: 38 }} />
            </View>
            {!isAdmin ? (
                <EmptyState
                    icon={<ShieldAlert size={30} color={colors.textMuted} strokeWidth={1.6} />}
                    title="Accès réservé"
                    message="Cet espace est réservé aux administrateurs de la plateforme."
                />
            ) : (
                <AdminContent />
            )}
        </SafeAreaView>
    );
}

function AdminContent() {
    const router = useRouter();
    const { data: stats, isLoading, refetch, isRefetching } = useAdminOverview();
    const { data: pendingArtisans } = usePendingArtisans();
    const { data: pendingCertifications } = usePendingCertifications();

    const nbArtisans = pendingArtisans?.length ?? stats?.utilisateurs.artisansEnAttente ?? 0;
    const nbDocuments = pendingCertifications?.length ?? 0;

    if (isLoading && !stats) {
        return (
            <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
                <Skeleton height={90} borderRadius={radii.lg} />
                <Skeleton height={90} borderRadius={radii.lg} />
                <Skeleton height={180} borderRadius={radii.lg} />
            </View>
        );
    }

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
            {/* Files de validation : le travail du jour */}
            <Text style={styles.sectionTitle}>À traiter</Text>
            <Pressable onPress={() => router.push('/admin/validations')} accessibilityRole="button">
                <Card
                    style={[
                        styles.queueCard,
                        nbArtisans + nbDocuments > 0 && { backgroundColor: colors.warningSoft },
                    ]}
                >
                    <View
                        style={[
                            styles.queueIcon,
                            nbArtisans + nbDocuments > 0 && { backgroundColor: colors.surface },
                        ]}
                    >
                        <FileSearch
                            size={20}
                            color={
                                nbArtisans + nbDocuments > 0
                                    ? palette.terracotta700
                                    : colors.primary
                            }
                            strokeWidth={2}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.queueTitle}>Validations en attente</Text>
                        <Text style={styles.queueText}>
                            {nbArtisans} artisan{nbArtisans > 1 ? 's' : ''} · {nbDocuments}{' '}
                            document{nbDocuments > 1 ? 's' : ''} à examiner
                        </Text>
                    </View>
                    <ChevronRight size={18} color={colors.textMuted} strokeWidth={2.2} />
                </Card>
            </Pressable>

            <Pressable
                onPress={() => router.push('/admin/deverrouiller')}
                accessibilityRole="button"
            >
                <Card style={styles.queueCard}>
                    <View style={styles.queueIcon}>
                        <LockOpen size={19} color={colors.primary} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.queueTitle}>Déverrouiller un document</Text>
                        <Text style={styles.queueText}>
                            Autoriser un artisan à modifier une pièce déjà validée
                        </Text>
                    </View>
                    <ChevronRight size={18} color={colors.textMuted} strokeWidth={2.2} />
                </Card>
            </Pressable>

            <Pressable onPress={() => router.push('/admin/fraude')} accessibilityRole="button">
                <Card style={styles.queueCard}>
                    <View style={styles.queueIcon}>
                        <ShieldAlert size={19} color={colors.primary} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.queueTitle}>Anti-fraude</Text>
                        <Text style={styles.queueText}>
                            Artisans à haut risque et scan des comptes suspects
                        </Text>
                    </View>
                    <ChevronRight size={18} color={colors.textMuted} strokeWidth={2.2} />
                </Card>
            </Pressable>

            {/* KPI plateforme */}
            <Text style={styles.sectionTitle}>La plateforme</Text>
            <View style={styles.grid}>
                <Kpi
                    icon={<Users size={16} color={colors.primary} strokeWidth={2} />}
                    value={String(stats?.utilisateurs.total ?? 0)}
                    label="utilisateurs"
                />
                <Kpi
                    icon={<BadgeCheck size={16} color={palette.green600} strokeWidth={2} />}
                    value={String(stats?.utilisateurs.artisansActifs ?? 0)}
                    label={`artisans actifs / ${stats?.utilisateurs.artisans ?? 0}`}
                />
                <Kpi
                    icon={<CalendarDays size={16} color={colors.accent} strokeWidth={2} />}
                    value={String(stats?.bookings.ceMois ?? 0)}
                    label={`demandes ce mois (${stats?.bookings.tauxCompletion ?? 0}% terminées)`}
                />
                <Kpi
                    icon={<Star size={16} color="#F59E0B" strokeWidth={2} />}
                    value={Number(stats?.avis.noteMoyennePlateforme ?? 0).toFixed(1)}
                    label={`note moyenne · ${stats?.avis.total ?? 0} avis`}
                />
            </View>
            <Card style={styles.revenueCard}>
                <View style={styles.queueIcon}>
                    <Wallet size={18} color={palette.green700} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.queueText}>Revenus encaissés ce mois</Text>
                    <Text style={styles.revenueValue}>
                        {Number(stats?.revenus.ceMois ?? 0).toLocaleString('fr-FR')} FCFA
                    </Text>
                    <Text style={styles.queueText}>
                        Total : {Number(stats?.revenus.total ?? 0).toLocaleString('fr-FR')} FCFA ·
                        commissions {Number(stats?.revenus.commissionsTotal ?? 0).toLocaleString('fr-FR')}{' '}
                        FCFA
                    </Text>
                </View>
            </Card>
        </ScrollView>
    );
}

function Kpi({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
    return (
        <Card style={styles.kpi}>
            {icon}
            <Text style={styles.kpiValue}>{value}</Text>
            <Text style={styles.kpiLabel} numberOfLines={2}>
                {label}
            </Text>
        </Card>
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
    sectionTitle: {
        fontFamily: typography.heading,
        fontSize: fontSizes.base,
        color: colors.text,
        marginTop: spacing.sm,
    },
    queueCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    queueIcon: {
        width: 40,
        height: 40,
        borderRadius: radii.full,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    queueTitle: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    queueText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 3,
        color: colors.textSecondary,
        marginTop: 1,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
    },
    kpi: {
        width: '47%',
        flexGrow: 1,
        gap: spacing.xs,
    },
    kpiValue: {
        fontFamily: typography.heading,
        fontSize: fontSizes.xl,
        color: colors.text,
        letterSpacing: -0.4,
    },
    kpiLabel: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
    revenueCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    revenueValue: {
        fontFamily: typography.heading,
        fontSize: fontSizes.xl,
        color: palette.green700,
        letterSpacing: -0.4,
    },
});
