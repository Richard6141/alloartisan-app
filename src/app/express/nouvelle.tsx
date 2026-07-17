import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    Switch,
    Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, LocateFixed, Zap } from 'lucide-react-native';
import { api, ApiError } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { resolvePosition } from '../../lib/geo';
import { useCreateDemandeExpress } from '../../features/express/hooks';
import { Button, Input } from '../../components/ui';
import type { Metier } from '../../types/api';
import { colors, palette, spacing, typography, fontSizes, lineHeights, radii } from '../../theme/tokens';

/**
 * Demande Express (dispatch) — le client décrit son besoin, on diffuse aux
 * artisans proches disponibles ; le premier qui accepte décroche. Accessible
 * depuis le bouton « SOS Urgence » de l'accueil (urgence activée par défaut).
 */
export default function NouvelleDemandeExpressScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ metierId?: string; urgence?: string }>();
    const creer = useCreateDemandeExpress();

    const { data: metiers } = useQuery({
        queryKey: queryKeys.metiers,
        queryFn: async () => {
            const { data } = await api.get<Metier[] | { data: Metier[] }>('/metiers');
            return Array.isArray(data) ? data : data.data;
        },
        staleTime: 24 * 60 * 60 * 1000,
    });

    const [metierId, setMetierId] = useState<string | null>(params.metierId ?? null);
    const [titre, setTitre] = useState('');
    const [description, setDescription] = useState('');
    const [ville, setVille] = useState('');
    const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [locating, setLocating] = useState(false);
    // Urgence ON par défaut : ce parcours est le « je veux quelqu'un vite »
    const [urgent, setUrgent] = useState(params.urgence !== '0');

    const capturePosition = async (silent = false) => {
        setLocating(true);
        const pos = await resolvePosition();
        setLocating(false);
        if (!pos) {
            if (!silent) {
                Alert.alert(
                    'Position requise',
                    'Autorisez la localisation pour trouver les artisans proches de vous.',
                );
            }
            return;
        }
        setCoords({ latitude: pos.latitude, longitude: pos.longitude });
        if (pos.ville) setVille(pos.ville);
    };

    // On tente de récupérer la position dès l'ouverture (gain de temps)
    useEffect(() => {
        void capturePosition(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const lancer = (rayonKm?: number) => {
        if (!metierId || !coords) return;
        creer.mutate(
            {
                metierId,
                titre: titre.trim(),
                description: description.trim(),
                adresseIntervention: ville.trim() || 'À proximité',
                latitude: coords.latitude,
                longitude: coords.longitude,
                estUrgent: urgent,
                ...(rayonKm ? { rayonKm } : {}),
            },
            {
                onSuccess: (demande) => {
                    router.replace({ pathname: '/express/[id]', params: { id: demande.id } });
                },
                onError: (e) => {
                    const status = e instanceof ApiError ? e.status : 0;
                    const msg = e instanceof ApiError ? e.message : 'Réessayez plus tard.';
                    // 404 = aucun artisan dans le rayon → proposer d'ÉLARGIR ou de chercher soi-même
                    if (status === 404) {
                        const prochain = !rayonKm ? 25 : rayonKm < 50 ? 50 : null;
                        const boutons: Parameters<typeof Alert.alert>[2] = [
                            { text: 'Fermer', style: 'cancel' },
                            {
                                text: 'Chercher moi-même',
                                onPress: () =>
                                    router.replace({
                                        pathname: '/(tabs)/recherche',
                                        params: {
                                            urgence: urgent ? '1' : undefined,
                                            metierId: metierId ?? undefined,
                                        },
                                    }),
                            },
                        ];
                        if (prochain) {
                            boutons.push({
                                text: `Élargir à ${prochain} km`,
                                onPress: () => lancer(prochain),
                            });
                        }
                        Alert.alert('Aucun artisan tout près', msg, boutons);
                    } else {
                        Alert.alert('Demande impossible', msg);
                    }
                },
            },
        );
    };

    const submit = () => {
        if (!metierId) {
            Alert.alert('Métier requis', 'Choisissez le type d’artisan dont vous avez besoin.');
            return;
        }
        if (titre.trim().length < 3) {
            Alert.alert('Titre requis', 'Résumez votre besoin en quelques mots.');
            return;
        }
        if (description.trim().length < 5) {
            Alert.alert('Détail requis', 'Décrivez un peu plus votre besoin.');
            return;
        }
        if (!coords) {
            Alert.alert(
                'Position requise',
                'Touchez « Utiliser ma position » pour trouver les artisans proches.',
            );
            return;
        }
        lancer();
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.topBar}>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
                    <ArrowLeft size={20} color={colors.text} strokeWidth={2.2} />
                </Pressable>
                <Text style={styles.title}>Demande express</Text>
                <View style={{ width: 38 }} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <View style={styles.hero}>
                        <View style={styles.heroIcon}>
                            <Zap size={18} color={palette.white} fill={palette.white} strokeWidth={0} />
                        </View>
                        <Text style={styles.heroText}>
                            On prévient d’un coup tous les artisans proches et disponibles. Le premier
                            qui accepte vous rappelle — pas besoin de choisir un par un.
                        </Text>
                    </View>

                    {/* Métier */}
                    <Text style={styles.label}>De quel artisan avez-vous besoin ? *</Text>
                    <View style={styles.chips}>
                        {(metiers ?? []).map((m) => {
                            const on = metierId === m.id;
                            return (
                                <Pressable
                                    key={m.id}
                                    onPress={() => setMetierId(m.id)}
                                    style={[styles.chip, on && styles.chipOn]}
                                >
                                    <Text style={[styles.chipText, on && { color: colors.onPrimary }]}>
                                        {m.nom}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    <Input
                        label="Votre besoin en quelques mots *"
                        placeholder="Ex. : Fuite sous l’évier"
                        value={titre}
                        onChangeText={setTitre}
                        maxLength={200}
                    />
                    <Input
                        label="Décrivez un peu plus *"
                        placeholder="Ce qui se passe, l’étage, l’accès…"
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={3}
                        style={{ minHeight: 80, textAlignVertical: 'top' }}
                        maxLength={2000}
                    />

                    {/* Position */}
                    <Pressable onPress={() => void capturePosition()} style={styles.locateBtn}>
                        <LocateFixed
                            size={15}
                            color={coords ? colors.success : colors.primary}
                            strokeWidth={2}
                        />
                        <Text style={[styles.locateTxt, coords != null && { color: colors.success }]}>
                            {locating
                                ? 'Localisation…'
                                : coords
                                  ? `Position enregistrée ✓${ville ? ` · ${ville}` : ''}`
                                  : 'Utiliser ma position (requis)'}
                        </Text>
                    </Pressable>

                    {/* Urgence */}
                    <View style={styles.switchRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.switchTitle}>🚨 C’est urgent</Text>
                            <Text style={styles.switchHint}>Intervention au plus vite</Text>
                        </View>
                        <Switch
                            value={urgent}
                            onValueChange={setUrgent}
                            trackColor={{ true: palette.red600, false: colors.border }}
                            thumbColor={colors.surface}
                        />
                    </View>

                    <Button
                        title="⚡ Lancer la recherche"
                        size="lg"
                        fullWidth
                        loading={creer.isPending}
                        onPress={submit}
                        style={{ marginTop: spacing.md }}
                    />
                    <Text style={styles.note}>
                        Gratuit. Le prix se discute directement avec l’artisan qui accepte.
                    </Text>
                </ScrollView>
            </KeyboardAvoidingView>
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
    content: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing['4xl'],
        gap: spacing.lg,
    },
    hero: {
        flexDirection: 'row',
        gap: spacing.md,
        alignItems: 'center',
        backgroundColor: colors.primarySoft,
        borderRadius: radii.lg,
        padding: spacing.lg,
    },
    heroIcon: {
        width: 36,
        height: 36,
        borderRadius: radii.full,
        backgroundColor: palette.red600,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroText: {
        flex: 1,
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        lineHeight: lineHeights.sm + 3,
        color: colors.textSecondary,
    },
    label: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.text,
        marginBottom: -spacing.xs,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
        paddingHorizontal: spacing.md,
        height: 36,
        justifyContent: 'center',
        borderRadius: radii.full,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
    locateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        alignSelf: 'flex-start',
        paddingVertical: spacing.xs,
    },
    locateTxt: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.primary,
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
    },
    switchTitle: { fontFamily: typography.bodyBold, fontSize: fontSizes.base, color: colors.text },
    switchHint: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    note: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        textAlign: 'center',
    },
});
