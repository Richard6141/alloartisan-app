import React from 'react';
import { View, Text, StyleSheet, Pressable, Share, ScrollView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Gift, TicketPercent, Share2 } from 'lucide-react-native';
import { api } from '../lib/api';
import { useAuth } from '../stores/auth';
import { suppressLock } from '../lib/lockGuard';
import { LoginInvite } from '../components/LoginInvite';
import { Skeleton, EmptyState, Button } from '../components/ui';
import { colors, palette, spacing, typography, fontSizes, lineHeights, radii } from '../theme/tokens';

interface Reward {
    code: string;
    valeur: number;
    typeReduction: 'POURCENTAGE' | 'MONTANT_FIXE';
    description?: string | null;
    validUntil: string;
}

/** Mes codes de récompense (parrainage) — à utiliser au paiement */
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
                <Text style={styles.title}>Mes récompenses</Text>
                <View style={{ width: 38 }} />
            </View>

            {status !== 'authenticated' ? (
                <LoginInvite
                    title="Vos récompenses"
                    message="Connectez-vous pour retrouver vos codes de réduction gagnés par parrainage."
                />
            ) : (
                <RewardsList />
            )}
        </SafeAreaView>
    );
}

function RewardsList() {
    const router = useRouter();
    const { data: rewards, isLoading } = useQuery({
        queryKey: ['promo', 'rewards'],
        queryFn: async () => {
            const { data } = await api.get<Reward[]>('/promo/rewards');
            return data;
        },
    });

    if (isLoading && !rewards) {
        return (
            <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
                {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} height={96} borderRadius={radii.lg} />
                ))}
            </View>
        );
    }

    if (!rewards || rewards.length === 0) {
        return (
            <EmptyState
                icon={<Gift size={44} color={colors.textMuted} strokeWidth={1.5} />}
                title="Pas encore de récompense"
                message="Parrainez vos proches : vous gagnez 1 000 F par filleul qui paie sa première intervention (et lui 500 F)."
                action={
                    <Button
                        title="Voir mon code parrainage"
                        variant="secondary"
                        onPress={() => router.push('/(tabs)/profil')}
                    />
                }
            />
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.list}>
            <Text style={styles.hint}>
                Saisissez un code dans le champ « Code promo » au moment de payer une intervention.
            </Text>
            {rewards.map((reward) => (
                <RewardCard key={reward.code} reward={reward} />
            ))}
        </ScrollView>
    );
}

function RewardCard({ reward }: { reward: Reward }) {
    const montant =
        reward.typeReduction === 'MONTANT_FIXE'
            ? `${Number(reward.valeur).toLocaleString('fr-FR')} F`
            : `${Number(reward.valeur)} %`;
    const expire = new Date(reward.validUntil).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    const share = () => {
        suppressLock();
        void Share.share({
            message: `Mon code de réduction AlloArtisan : ${reward.code} (−${montant})`,
        });
    };

    return (
        <View style={styles.card}>
            <View style={styles.cardIcon}>
                <TicketPercent size={20} color="#047857" strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.cardAmount}>−{montant}</Text>
                <Text style={styles.cardCode}>{reward.code}</Text>
                {reward.description ? (
                    <Text style={styles.cardDesc} numberOfLines={1}>
                        {reward.description}
                    </Text>
                ) : null}
                <Text style={styles.cardExpire}>Valable jusqu'au {expire}</Text>
            </View>
            <Pressable
                onPress={share}
                hitSlop={10}
                style={styles.shareButton}
                accessibilityRole="button"
                accessibilityLabel="Partager le code"
            >
                <Share2 size={17} color={colors.primary} strokeWidth={2} />
            </Pressable>
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
    hint: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 3,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: '#F0FDF4',
        borderRadius: radii.lg,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#6EE7B7',
        padding: spacing.lg,
    },
    cardIcon: {
        width: 42,
        height: 42,
        borderRadius: radii.full,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardAmount: {
        fontFamily: typography.heading,
        fontSize: fontSizes.lg,
        color: '#047857',
        letterSpacing: -0.3,
    },
    cardCode: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.sm,
        letterSpacing: 1.5,
        color: colors.text,
        marginTop: 1,
    },
    cardDesc: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
    cardExpire: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs - 1,
        color: colors.textMuted,
        marginTop: 2,
    },
    shareButton: {
        width: 38,
        height: 38,
        borderRadius: radii.full,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
