import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { ArrowLeft, MapPinOff, Users, Megaphone, Plus } from 'lucide-react-native';
import { EmptyState } from '../components/ui';
import { TravailleurCard } from '../features/travailleurs/TravailleurCard';
import { useSearchTravailleurs, type SearchTravailleurFilters } from '../features/travailleurs/hooks';
import { resolveCoords } from '../lib/geo';
import { colors, palette, spacing, typography, fontSizes, radii } from '../theme/tokens';

type Filtre = 'TOUS' | 'OUVRIER' | 'AIDE';

export default function MainDoeuvreScreen() {
    const router = useRouter();
    const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
    const [denied, setDenied] = useState(false);
    const [filtre, setFiltre] = useState<Filtre>('TOUS');
    const [rayon] = useState(25);

    useEffect(() => {
        void (async () => {
            const coords = await resolveCoords();
            if (coords) setPosition(coords);
            else setDenied(true);
        })();
    }, []);

    const filters: SearchTravailleurFilters = filtre === 'TOUS' ? {} : { type: filtre };
    const { data, isLoading } = useSearchTravailleurs(position, rayon, filters);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={12}>
                    <ArrowLeft size={22} color={colors.text} strokeWidth={2} />
                </Pressable>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Main-d'œuvre</Text>
                    <Text style={styles.subtitle}>Ouvriers & aides autour de vous</Text>
                </View>
            </View>

            {/* Actions patron : publier / gérer ses annonces */}
            <View style={styles.actions}>
                <Pressable
                    style={[styles.action, styles.actionPrimary]}
                    onPress={() => router.push('/publier-annonce')}
                >
                    <Plus size={16} color={palette.white} strokeWidth={2.4} />
                    <Text style={[styles.actionTxt, { color: palette.white }]}>Publier une annonce</Text>
                </Pressable>
                <Pressable style={styles.action} onPress={() => router.push('/mes-annonces')}>
                    <Megaphone size={16} color={colors.primary} strokeWidth={2} />
                    <Text style={[styles.actionTxt, { color: colors.primary }]}>Mes annonces</Text>
                </Pressable>
            </View>

            {/* Filtre type */}
            <View style={styles.segment}>
                {(
                    [
                        { v: 'TOUS', t: 'Tous' },
                        { v: 'OUVRIER', t: 'Ouvriers' },
                        { v: 'AIDE', t: 'Aides' },
                    ] as const
                ).map(({ v, t }) => {
                    const sel = filtre === v;
                    return (
                        <Pressable
                            key={v}
                            onPress={() => setFiltre(v)}
                            style={[styles.seg, sel && styles.segSel]}
                        >
                            <Text style={[styles.segTxt, sel && { color: palette.white }]}>{t}</Text>
                        </Pressable>
                    );
                })}
            </View>

            {denied ? (
                <EmptyState
                    icon={<MapPinOff size={44} color={colors.textMuted} strokeWidth={1.5} />}
                    title="Localisation requise"
                    message="Autorisez la localisation pour trouver la main-d'œuvre proche des chantiers."
                />
            ) : !position || isLoading ? (
                <View style={styles.loader}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : !data || data.length === 0 ? (
                <EmptyState
                    icon={<Users size={44} color={colors.textMuted} strokeWidth={1.5} />}
                    title="Personne pour le moment"
                    message="Aucun ouvrier ni aide disponible dans ce rayon. Réessayez plus tard."
                />
            ) : (
                <FlashList
                    data={data}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing['3xl'] }}
                    renderItem={({ item }) => (
                        <TravailleurCard
                            travailleur={item}
                            onPress={() =>
                                router.push({
                                    pathname: '/travailleur/[id]',
                                    params: { id: item.id },
                                })
                            }
                        />
                    )}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
    },
    title: { fontFamily: typography.heading, fontSize: fontSizes.xl, color: colors.text },
    subtitle: { fontFamily: typography.body, fontSize: fontSizes.xs, color: colors.textSecondary },
    actions: {
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.md,
    },
    action: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.primary,
        backgroundColor: colors.surface,
    },
    actionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
    actionTxt: { fontFamily: typography.bodySemiBold, fontSize: fontSizes.sm },
    segment: {
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.md,
    },
    seg: {
        paddingVertical: 7,
        paddingHorizontal: spacing.lg,
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    segSel: { backgroundColor: colors.primary, borderColor: colors.primary },
    segTxt: { fontFamily: typography.bodySemiBold, fontSize: fontSizes.sm, color: colors.textSecondary },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
