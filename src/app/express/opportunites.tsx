import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Zap, MapPin, Clock3 } from 'lucide-react-native';
import { ApiError } from '../../lib/api';
import {
    useMesOpportunites,
    useAccepterDemandeExpress,
    type OpportuniteExpress,
} from '../../features/express/hooks';
import { Button, Card, EmptyState, Skeleton } from '../../components/ui';
import { colors, palette, spacing, typography, fontSizes, lineHeights, radii } from '../../theme/tokens';

/**
 * Opportunités express (artisan) : demandes diffusées auxquelles il a été convié.
 * Le premier qui accepte décroche → on file sur la mission créée.
 */
export default function OpportunitesExpressScreen() {
    const router = useRouter();
    const { data, isLoading, refetch, isRefetching } = useMesOpportunites();
    const accepter = useAccepterDemandeExpress();

    const onAccepter = (o: OpportuniteExpress) => {
        accepter.mutate(o.demandeId, {
            onSuccess: (res) =>
                router.replace({ pathname: '/booking/[id]', params: { id: res.bookingId } }),
            onError: (e) => {
                const msg = e instanceof ApiError ? e.message : 'Réessayez.';
                Alert.alert('Trop tard', msg);
                void refetch();
            },
        });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.topBar}>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
                    <ArrowLeft size={20} color={colors.text} strokeWidth={2.2} />
                </Pressable>
                <Text style={styles.title}>Demandes express</Text>
                <View style={{ width: 38 }} />
            </View>

            {isLoading && !data ? (
                <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
                    <Skeleton height={120} borderRadius={radii.lg} />
                    <Skeleton height={120} borderRadius={radii.lg} />
                </View>
            ) : !data || data.length === 0 ? (
                <EmptyState
                    icon={<Zap size={30} color={colors.textMuted} strokeWidth={1.6} />}
                    title="Aucune demande pour l’instant"
                    message="Dès qu’un client proche cherche votre métier, sa demande apparaît ici. Le premier qui accepte décroche la mission."
                />
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefetching}
                            onRefresh={() => void refetch()}
                            tintColor={colors.primary}
                        />
                    }
                >
                    {data.map((o) => (
                        <Card key={o.demandeId} style={styles.card}>
                            <View style={styles.cardHead}>
                                {o.estUrgent && (
                                    <View style={styles.urgentChip}>
                                        <Zap size={10} color={palette.white} fill={palette.white} strokeWidth={0} />
                                        <Text style={styles.urgentTxt}>Urgent</Text>
                                    </View>
                                )}
                                <Text style={styles.cardTitle} numberOfLines={1}>
                                    {o.titre}
                                </Text>
                            </View>
                            {o.metier ? <Text style={styles.metier}>{o.metier}</Text> : null}
                            <Text style={styles.desc} numberOfLines={3}>
                                {o.description}
                            </Text>
                            <View style={styles.metaRow}>
                                <MapPin size={12} color={colors.textMuted} strokeWidth={2} />
                                <Text style={styles.meta} numberOfLines={1}>
                                    {o.adresseIntervention}
                                    {o.distanceKm != null
                                        ? ` · ${o.distanceKm.toFixed(1).replace('.', ',')} km`
                                        : ''}
                                </Text>
                            </View>
                            <View style={styles.metaRow}>
                                <Clock3 size={12} color={colors.textMuted} strokeWidth={2} />
                                <Text style={styles.meta}>Le premier qui accepte décroche</Text>
                            </View>
                            <Button
                                title="Accepter la mission"
                                fullWidth
                                loading={accepter.isPending && accepter.variables === o.demandeId}
                                disabled={accepter.isPending}
                                onPress={() => onAccepter(o)}
                                style={{ marginTop: spacing.sm }}
                            />
                        </Card>
                    ))}
                </ScrollView>
            )}
        </SafeAreaView>
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
    content: { paddingHorizontal: spacing.xl, paddingBottom: spacing['3xl'], gap: spacing.md },
    card: { gap: spacing.xs },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    urgentChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: palette.red600,
        borderRadius: radii.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
    },
    urgentTxt: { fontFamily: typography.bodyBold, fontSize: 9, color: palette.white },
    cardTitle: {
        flex: 1,
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.base,
        color: colors.text,
    },
    metier: { fontFamily: typography.bodyMedium, fontSize: fontSizes.xs, color: colors.primary },
    desc: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        lineHeight: lineHeights.sm + 2,
        color: colors.textSecondary,
        marginTop: 2,
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    meta: { fontFamily: typography.body, fontSize: fontSizes.xs, color: colors.textMuted, flexShrink: 1 },
});
