import React, { useMemo, useState } from 'react';
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
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { ArrowLeft, MapPin, LocateFixed } from 'lucide-react-native';
import { LiveMap } from '../../components/LiveMap';
import { useArtisan } from '../../features/artisans/hooks';
import { useCreateBooking } from '../../features/bookings/hooks';
import { Avatar, Button, Input, Card } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { colors, spacing, typography, fontSizes, radii } from '../../theme/tokens';

export default function NewBookingScreen() {
    const { artisanId } = useLocalSearchParams<{ artisanId: string }>();
    const router = useRouter();
    const { data: artisan } = useArtisan(artisanId);
    const createBooking = useCreateBooking();

    const [metierId, setMetierId] = useState<string | undefined>();
    const [titre, setTitre] = useState('');
    const [description, setDescription] = useState('');
    const [adresse, setAdresse] = useState('');
    const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [urgent, setUrgent] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [locating, setLocating] = useState(false);

    const metiers = useMemo(() => artisan?.metiers ?? [], [artisan]);
    const selectedMetier = metierId ?? metiers.find((m) => m.estPrincipal)?.metier.id ?? metiers[0]?.metier.id;

    const useMyLocation = async () => {
        setLocating(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Position refusée',
                    "Autorisez la localisation pour que l'artisan trouve facilement l'adresse.",
                );
                return;
            }
            const pos = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            // Adresse lisible si possible
            const [place] = await Location.reverseGeocodeAsync(pos.coords);
            if (place && !adresse) {
                setAdresse(
                    [place.street, place.district, place.city].filter(Boolean).join(', '),
                );
            }
        } catch {
            Alert.alert('Erreur', 'Impossible de récupérer votre position.');
        } finally {
            setLocating(false);
        }
    };

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (titre.trim().length < 5) e.titre = 'Au moins 5 caractères';
        if (description.trim().length < 20)
            e.description = 'Décrivez le problème en au moins 20 caractères';
        if (adresse.trim().length < 5) e.adresse = "Précisez l'adresse d'intervention";
        if (!selectedMetier) e.metier = 'Sélectionnez un métier';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const submit = () => {
        if (!validate() || !selectedMetier) return;
        createBooking.mutate(
            {
                artisanId,
                metierId: selectedMetier,
                titre: titre.trim(),
                description: description.trim(),
                adresseIntervention: adresse.trim(),
                latitudeIntervention: coords?.latitude,
                longitudeIntervention: coords?.longitude,
                estUrgent: urgent,
                type: urgent ? 'URGENCE' : 'STANDARD',
            },
            {
                onSuccess: (booking) => {
                    router.replace({ pathname: '/booking/[id]', params: { id: booking.id } });
                },
                onError: (e) => {
                    Alert.alert(
                        'Demande impossible',
                        e instanceof ApiError ? e.message : 'Réessayez plus tard.',
                    );
                },
            },
        );
    };

    const nomArtisan =
        artisan?.nomEntreprise ??
        `${artisan?.user?.prenom ?? ''} ${artisan?.user?.nom ?? ''}`.trim();

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
                    <ArrowLeft size={22} color={colors.text} strokeWidth={2} />
                </Pressable>
                <Text style={styles.title}>Nouvelle demande</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Artisan choisi */}
                    {artisan && (
                        <Card style={styles.artisanCard}>
                            <Avatar
                                name={nomArtisan}
                                uri={artisan.photoProfilUrl ?? artisan.user?.photoUrl}
                                size={44}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.artisanName}>{nomArtisan}</Text>
                                <Text style={styles.artisanMeta}>
                                    ⭐ {Number(artisan.noteMoyenne).toFixed(1)} ·{' '}
                                    {artisan.villePrincipale}
                                </Text>
                            </View>
                        </Card>
                    )}

                    {/* Métier */}
                    {metiers.length > 1 && (
                        <View>
                            <Text style={styles.fieldLabel}>Métier concerné</Text>
                            <View style={styles.metierRow}>
                                {metiers.map((m) => {
                                    const selected = selectedMetier === m.metier.id;
                                    return (
                                        <Pressable
                                            key={m.metier.id}
                                            onPress={() => setMetierId(m.metier.id)}
                                            style={[
                                                styles.metierChip,
                                                selected && styles.metierChipSelected,
                                            ]}
                                            accessibilityRole="radio"
                                            accessibilityState={{ selected }}
                                        >
                                            <Text
                                                style={[
                                                    styles.metierChipLabel,
                                                    selected && { color: colors.onPrimary },
                                                ]}
                                            >
                                                {m.metier.nom}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    <Input
                        label="Titre de la demande"
                        placeholder="Ex. : Fuite sous l'évier de la cuisine"
                        value={titre}
                        onChangeText={setTitre}
                        error={errors.titre}
                        maxLength={200}
                    />

                    <Input
                        label="Description du problème"
                        placeholder="Décrivez ce qui ne va pas, depuis quand, ce que vous avez déjà essayé…"
                        value={description}
                        onChangeText={setDescription}
                        error={errors.description}
                        multiline
                        numberOfLines={4}
                        style={{ minHeight: 100, textAlignVertical: 'top' }}
                        maxLength={2000}
                    />

                    <View>
                        <Input
                            label="Adresse d'intervention"
                            placeholder="Quartier, rue, repère…"
                            value={adresse}
                            onChangeText={setAdresse}
                            error={errors.adresse}
                            leftIcon={
                                <MapPin size={18} color={colors.textSecondary} strokeWidth={2} />
                            }
                        />
                        <Pressable
                            onPress={useMyLocation}
                            style={styles.locateButton}
                            accessibilityRole="button"
                        >
                            <LocateFixed
                                size={15}
                                color={coords ? colors.success : colors.primary}
                                strokeWidth={2}
                            />
                            <Text
                                style={[
                                    styles.locateText,
                                    coords != null && { color: colors.success },
                                ]}
                            >
                                {locating
                                    ? 'Localisation…'
                                    : coords
                                      ? 'Position GPS enregistrée ✓'
                                      : 'Utiliser ma position actuelle'}
                            </Text>
                        </Pressable>
                        {/* Aperçu de la position récupérée sur la carte */}
                        {coords && (
                            <LiveMap
                                point={coords}
                                rounded
                                style={{ height: 150, marginTop: spacing.md }}
                            />
                        )}
                    </View>

                    {/* PIVOT PROXIMITÉ : aucun montant dans la demande — le prix
                        se discute directement avec l'artisan */}

                    {/* Urgence */}
                    <Card style={styles.urgentCard}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.urgentTitle}>🔥 Intervention urgente</Text>
                            <Text style={styles.urgentText}>
                                L'artisan est prévenu immédiatement et répond sous 2 h
                            </Text>
                        </View>
                        <Switch
                            value={urgent}
                            onValueChange={setUrgent}
                            trackColor={{ true: colors.accent, false: colors.border }}
                            thumbColor={colors.surface}
                        />
                    </Card>

                    <Button
                        title="Envoyer la demande"
                        size="lg"
                        fullWidth
                        loading={createBooking.isPending}
                        onPress={submit}
                        style={{ marginTop: spacing.sm }}
                    />
                    <Text style={styles.disclaimer}>
                        Gratuit et sans engagement : vous ne payez qu'après le travail effectué.
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
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
    },
    backButton: {
        width: 40,
        height: 40,
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
    },
    content: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing['4xl'],
        gap: spacing.xl,
    },
    artisanCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    artisanName: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.md,
        color: colors.text,
    },
    artisanMeta: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        marginTop: 2,
    },
    fieldLabel: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    metierRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    metierChip: {
        paddingHorizontal: spacing.lg,
        height: 38,
        justifyContent: 'center',
        borderRadius: radii.full,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    metierChipSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    metierChipLabel: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    locateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: spacing.sm,
        alignSelf: 'flex-start',
        paddingVertical: spacing.xs,
    },
    locateText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.primary,
    },
    urgentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    urgentTitle: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.base,
        color: colors.text,
    },
    urgentText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    disclaimer: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        textAlign: 'center',
    },
});
