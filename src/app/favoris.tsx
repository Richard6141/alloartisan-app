import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { ArrowLeft, HeartOff } from 'lucide-react-native';
import { api } from '../lib/api';
import { queryKeys } from '../lib/queryClient';
import { useAuth } from '../stores/auth';
import { LoginInvite } from '../components/LoginInvite';
import { ArtisanCard } from '../features/catalog/ArtisanCard';
import { Skeleton, EmptyState, Button } from '../components/ui';
import type { ArtisanSummary } from '../types/api';
import { colors, spacing, typography, fontSizes, radii } from '../theme/tokens';

interface FavorisResponse {
    data: { favoriId: string; ajouteLe: string; artisan: ArtisanSummary }[];
}

export default function FavorisScreen() {
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
                <Text style={styles.title}>Mes favoris</Text>
                <View style={{ width: 38 }} />
            </View>

            {status !== 'authenticated' ? (
                <LoginInvite
                    title="Vos artisans favoris"
                    message="Connectez-vous pour retrouver ici les artisans que vous avez mis de côté."
                />
            ) : (
                <FavorisList />
            )}
        </SafeAreaView>
    );
}

function FavorisList() {
    const router = useRouter();
    const { data, isLoading } = useQuery({
        queryKey: queryKeys.favoris,
        queryFn: async () => {
            const { data } = await api.get<FavorisResponse>('/favoris');
            return data.data;
        },
    });

    if (isLoading && !data) {
        return (
            <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} height={84} borderRadius={radii.lg} />
                ))}
            </View>
        );
    }

    if (!data || data.length === 0) {
        return (
            <EmptyState
                icon={<HeartOff size={44} color={colors.textMuted} strokeWidth={1.5} />}
                title="Aucun favori"
                message="Touchez le cœur sur le profil d'un artisan pour le garder sous la main."
                action={
                    <Button
                        title="Découvrir les artisans"
                        variant="secondary"
                        onPress={() => router.push('/(tabs)/recherche')}
                    />
                }
            />
        );
    }

    return (
        <FlashList
            data={data}
            keyExtractor={(item) => item.favoriId}
            contentContainerStyle={{
                paddingHorizontal: spacing.xl,
                paddingTop: spacing.sm,
                paddingBottom: spacing['3xl'],
            }}
            ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
            renderItem={({ item }) => (
                <ArtisanCard
                    artisan={item.artisan}
                    onPress={() =>
                        router.push({ pathname: '/artisan/[id]', params: { id: item.artisan.id } })
                    }
                />
            )}
        />
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
});
