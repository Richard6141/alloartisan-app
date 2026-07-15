import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { ArrowLeft, Wallet, ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import { api } from '../lib/api';
import { useAuth } from '../stores/auth';
import { LoginInvite } from '../components/LoginInvite';
import { Skeleton, EmptyState, Badge } from '../components/ui';
import { colors, palette, spacing, typography, fontSizes, radii, shadows } from '../theme/tokens';

interface Transaction {
    id: string;
    montant: number;
    montantArtisan: number;
    statut: 'EN_ATTENTE' | 'COMPLETEE' | 'ECHOUEE' | 'REMBOURSEE';
    provider: string;
    createdAt: string;
    booking?: { id: string; titre: string };
}

const STATUS_META: Record<
    Transaction['statut'],
    { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
    COMPLETEE: { label: 'Payé', tone: 'success' },
    EN_ATTENTE: { label: 'En attente', tone: 'warning' },
    ECHOUEE: { label: 'Échoué', tone: 'danger' },
    REMBOURSEE: { label: 'Remboursé', tone: 'neutral' },
};

const PROVIDER_LABELS: Record<string, string> = {
    kkiapay: 'Mobile Money',
    fedapay: 'FedaPay',
    cash: 'Espèces',
};

/** Historique des paiements (client : dépenses · artisan : gains) */
export default function PaiementsScreen() {
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
                <Text style={styles.title}>Mes paiements</Text>
                <View style={{ width: 38 }} />
            </View>

            {status !== 'authenticated' ? (
                <LoginInvite
                    title="Vos paiements"
                    message="Connectez-vous pour retrouver l'historique de vos transactions."
                />
            ) : (
                <PaymentsList />
            )}
        </SafeAreaView>
    );
}

function PaymentsList() {
    const router = useRouter();
    const isArtisan = useAuth((s) => s.user?.role === 'ARTISAN');

    const { data, isLoading } = useQuery({
        queryKey: ['payments', 'history'],
        queryFn: async () => {
            const { data } = await api.get<Transaction[]>('/payments/history');
            return data;
        },
    });

    if (isLoading && !data) {
        return (
            <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} height={76} borderRadius={radii.md} />
                ))}
            </View>
        );
    }

    if (!data || data.length === 0) {
        return (
            <EmptyState
                icon={<Wallet size={44} color={colors.textMuted} strokeWidth={1.5} />}
                title="Aucune transaction"
                message={
                    isArtisan
                        ? 'Vos gains apparaîtront ici après vos premières interventions payées.'
                        : 'Vos paiements apparaîtront ici après votre première intervention.'
                }
            />
        );
    }

    return (
        <FlashList
            data={data}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
                paddingHorizontal: spacing.xl,
                paddingBottom: spacing['3xl'],
            }}
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
            renderItem={({ item }) => (
                <Pressable
                    onPress={() =>
                        item.booking &&
                        router.push({
                            pathname: '/booking/[id]',
                            params: { id: item.booking.id },
                        })
                    }
                    accessibilityRole="button"
                >
                    <TransactionRow transaction={item} isArtisan={isArtisan} />
                </Pressable>
            )}
        />
    );
}

function TransactionRow({
    transaction,
    isArtisan,
}: {
    transaction: Transaction;
    isArtisan: boolean;
}) {
    const meta = STATUS_META[transaction.statut] ?? STATUS_META.EN_ATTENTE;
    const montant = isArtisan ? transaction.montantArtisan : transaction.montant;
    const date = new Date(transaction.createdAt).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });

    return (
        <View style={styles.row}>
            <View
                style={[
                    styles.rowIcon,
                    { backgroundColor: isArtisan ? '#DCFCE7' : colors.primarySoft },
                ]}
            >
                {isArtisan ? (
                    <ArrowDownLeft size={17} color={palette.green700} strokeWidth={2.2} />
                ) : (
                    <ArrowUpRight size={17} color={colors.primary} strokeWidth={2.2} />
                )}
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                    {transaction.booking?.titre ?? 'Intervention'}
                </Text>
                <Text style={styles.rowMeta}>
                    {PROVIDER_LABELS[transaction.provider] ?? transaction.provider} · {date}
                </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
                <Text
                    style={[
                        styles.rowAmount,
                        { color: isArtisan ? palette.green700 : colors.text },
                    ]}
                >
                    {isArtisan ? '+' : ''}
                    {Number(montant).toLocaleString('fr-FR')} F
                </Text>
                <Badge label={meta.label} tone={meta.tone} />
            </View>
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
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        ...shadows.card,
        shadowOpacity: 0.03,
    },
    rowIcon: {
        width: 38,
        height: 38,
        borderRadius: radii.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowTitle: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    rowMeta: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        marginTop: 1,
    },
    rowAmount: {
        fontFamily: typography.heading,
        fontSize: fontSizes.base,
        letterSpacing: -0.2,
    },
});
