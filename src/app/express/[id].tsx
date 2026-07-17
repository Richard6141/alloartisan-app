import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Zap, SearchX, CheckCircle2 } from 'lucide-react-native';
import { Button, Spinner } from '../../components/ui';
import { useDemandeExpress, useAnnulerDemandeExpress } from '../../features/express/hooks';
import { colors, palette, spacing, typography, fontSizes, lineHeights, radii } from '../../theme/tokens';

/**
 * « Recherche en cours… » : après une Demande Express, le client attend qu'un
 * artisan proche accepte. On poll l'état ; dès qu'un artisan décroche, on file
 * sur la mission ; si personne ne répond (expiration), on propose une issue.
 */
export default function DemandeExpressStatusScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { data, isLoading } = useDemandeExpress(id ?? null);
    const annuler = useAnnulerDemandeExpress();

    // Un artisan a accepté → on va sur la mission créée
    useEffect(() => {
        if (data?.statut === 'ATTRIBUEE' && data.bookingId) {
            router.replace({ pathname: '/booking/[id]', params: { id: data.bookingId } });
        }
    }, [data?.statut, data?.bookingId, router]);

    const onAnnuler = () => {
        Alert.alert('Arrêter la recherche ?', 'Votre demande express sera annulée.', [
            { text: 'Continuer la recherche', style: 'cancel' },
            {
                text: 'Arrêter',
                style: 'destructive',
                onPress: () =>
                    annuler.mutate(id, {
                        onSuccess: () => router.replace('/(tabs)'),
                        onError: () => router.replace('/(tabs)'),
                    }),
            },
        ]);
    };

    const statut = data?.statut;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />

            {statut === 'EXPIREE' ? (
                <View style={styles.center}>
                    <View style={[styles.bigIcon, { backgroundColor: colors.surfaceMuted }]}>
                        <SearchX size={40} color={colors.textMuted} strokeWidth={1.6} />
                    </View>
                    <Text style={styles.title}>Aucun artisan n’a répondu</Text>
                    <Text style={styles.text}>
                        Les artisans proches ne sont pas disponibles pour l’instant. Réessayez dans un
                        moment ou choisissez un artisan vous-même.
                    </Text>
                    <View style={styles.actions}>
                        <Button
                            title="Réessayer"
                            fullWidth
                            onPress={() => router.replace('/express/nouvelle')}
                        />
                        <Button
                            title="Choisir un artisan moi-même"
                            variant="ghost"
                            fullWidth
                            onPress={() => router.replace('/(tabs)/recherche')}
                        />
                    </View>
                </View>
            ) : statut === 'ANNULEE' ? (
                <View style={styles.center}>
                    <Text style={styles.title}>Recherche annulée</Text>
                    <Button
                        title="Retour à l’accueil"
                        onPress={() => router.replace('/(tabs)')}
                        style={{ marginTop: spacing.lg }}
                    />
                </View>
            ) : statut === 'ATTRIBUEE' ? (
                <View style={styles.center}>
                    <View style={[styles.bigIcon, { backgroundColor: colors.successSoft }]}>
                        <CheckCircle2 size={40} color={palette.green600} strokeWidth={2} />
                    </View>
                    <Text style={styles.title}>Un artisan a accepté !</Text>
                    <Text style={styles.text}>Ouverture de la mission…</Text>
                    <Spinner size={22} color={colors.primary} />
                </View>
            ) : (
                // EN_RECHERCHE (ou chargement initial)
                <View style={styles.center}>
                    <View style={styles.pulseWrap}>
                        <View style={styles.pulse}>
                            <Zap size={30} color={palette.white} fill={palette.white} strokeWidth={0} />
                        </View>
                    </View>
                    <Text style={styles.title}>Recherche d’un artisan…</Text>
                    <Text style={styles.text}>
                        {isLoading
                            ? 'Diffusion de votre demande…'
                            : `${data?.nbArtisansNotifies ?? 0} artisan${
                                  (data?.nbArtisansNotifies ?? 0) > 1 ? 's' : ''
                              } proche${(data?.nbArtisansNotifies ?? 0) > 1 ? 's' : ''} prévenu${
                                  (data?.nbArtisansNotifies ?? 0) > 1 ? 's' : ''
                              }. Le premier qui accepte vous sera présenté.`}
                    </Text>
                    <Spinner size={26} color={colors.primary} />
                    <Pressable onPress={onAnnuler} style={styles.cancelBtn} hitSlop={8}>
                        <Text style={styles.cancelTxt}>Arrêter la recherche</Text>
                    </Pressable>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing['2xl'],
        gap: spacing.lg,
    },
    pulseWrap: {
        width: 96,
        height: 96,
        borderRadius: radii.full,
        backgroundColor: 'rgba(220,38,38,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pulse: {
        width: 66,
        height: 66,
        borderRadius: radii.full,
        backgroundColor: palette.red600,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bigIcon: {
        width: 88,
        height: 88,
        borderRadius: radii.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontFamily: typography.heading,
        fontSize: fontSizes.xl,
        color: colors.text,
        textAlign: 'center',
        letterSpacing: -0.3,
    },
    text: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        lineHeight: lineHeights.sm + 3,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    actions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.md },
    cancelBtn: { marginTop: spacing.sm, paddingVertical: spacing.sm },
    cancelTxt: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.textMuted,
    },
});
