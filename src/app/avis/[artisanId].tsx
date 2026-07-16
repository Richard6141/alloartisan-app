import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { ArrowLeft, MessageSquareOff } from 'lucide-react-native';
import { useArtisanAvis } from '../../features/artisans/hooks';
import { useMyArtisanProfile } from '../../features/artisan/hooks';
import { AvisItem } from '../../features/artisans/AvisItem';
import { useAuth } from '../../stores/auth';
import { Skeleton, EmptyState } from '../../components/ui';
import { colors, spacing, typography, fontSizes, radii } from '../../theme/tokens';

/** Liste complète des avis d'un artisan */
export default function AvisListScreen() {
    const { artisanId, nom } = useLocalSearchParams<{ artisanId: string; nom?: string }>();
    const router = useRouter();
    const { data: avis, isLoading } = useArtisanAvis(artisanId, 50);
    // L'artisan propriétaire de ces avis peut y répondre
    const isArtisan = useAuth((s) => s.user?.role === 'ARTISAN');
    const { data: myArtisan } = useMyArtisanProfile(isArtisan);
    const canReply = isArtisan && myArtisan?.id === artisanId;

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
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Avis clients</Text>
                    {nom ? (
                        <Text style={styles.subtitle} numberOfLines={1}>
                            {nom}
                        </Text>
                    ) : null}
                </View>
            </View>

            {isLoading && !avis ? (
                <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} height={92} borderRadius={radii.md} />
                    ))}
                </View>
            ) : !avis || avis.length === 0 ? (
                <EmptyState
                    icon={<MessageSquareOff size={44} color={colors.textMuted} strokeWidth={1.5} />}
                    title="Aucun avis pour le moment"
                    message="Les avis apparaissent après les interventions terminées."
                />
            ) : (
                <FlashList
                    data={avis}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{
                        paddingHorizontal: spacing.xl,
                        paddingBottom: spacing['3xl'],
                    }}
                    ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
                    renderItem={({ item }) => (
                        <AvisItem avis={item} artisanId={artisanId} canReply={canReply} />
                    )}
                />
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
        fontFamily: typography.heading,
        fontSize: fontSizes.lg,
        color: colors.text,
        letterSpacing: -0.3,
    },
    subtitle: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
});
