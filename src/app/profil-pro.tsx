import React, { useEffect, useRef, useState } from 'react';
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
    ActivityIndicator,
    TextInput,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Camera, LocateFixed, Star, MapPin, Clock3 } from 'lucide-react-native';
import { LiveMap } from '../components/LiveMap';
import { api, ApiError } from '../lib/api';
import { queryKeys } from '../lib/queryClient';
import { suppressLock } from '../lib/lockGuard';
import { resolvePosition } from '../lib/geo';
import { useAuth } from '../stores/auth';
import { LoginInvite } from '../components/LoginInvite';
import { Button, Input, Card, Skeleton } from '../components/ui';
import {
    useMyArtisanProfile,
    useUpdateArtisanProfile,
    useUpdateArtisanMetiers,
} from '../features/artisan/hooks';
import type { HoraireTravail, Metier } from '../types/api';
import { colors, palette, spacing, typography, fontSizes, lineHeights, radii } from '../theme/tokens';

/**
 * Profil professionnel de l'artisan : tout ce que les clients voient et tout
 * ce qui pilote la recherche (zone d'intervention, métiers, tarifs, horaires).
 */

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const ZONES_KM = [5, 10, 15, 25, 50];

const HORAIRES_DEFAUT: HoraireTravail[] = JOURS.map((jour) => ({
    jour,
    ouverture: '08:00',
    fermeture: '18:00',
    ouvert: jour !== 'dimanche',
}));

interface MetierEdit {
    metierId: string;
    nom: string;
    estPrincipal: boolean;
}

export default function ProfilProScreen() {
    const status = useAuth((s) => s.status);
    const isArtisan = useAuth((s) => s.user?.role === 'ARTISAN');
    const router = useRouter();

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
                <Text style={styles.title}>Profil professionnel</Text>
                <View style={{ width: 38 }} />
            </View>
            {status !== 'authenticated' || !isArtisan ? (
                <LoginInvite
                    title="Espace artisan"
                    message="Connectez-vous avec un compte artisan pour gérer votre profil."
                />
            ) : (
                <ProfilProContent />
            )}
        </SafeAreaView>
    );
}

function ProfilProContent() {
    const router = useRouter();
    const userPhoto = useAuth((s) => s.user?.photoUrl);
    const { data: me, isLoading } = useMyArtisanProfile();
    const updateProfile = useUpdateArtisanProfile();
    const updateMetiers = useUpdateArtisanMetiers();

    const { data: metiersDispo } = useQuery({
        queryKey: queryKeys.metiers,
        queryFn: async () => {
            const { data } = await api.get<Metier[] | { data: Metier[] }>('/metiers');
            return Array.isArray(data) ? data : data.data;
        },
        staleTime: 24 * 60 * 60 * 1000,
    });

    // ─── État du formulaire, pré-rempli une seule fois depuis /artisans/me ───
    const [nomEntreprise, setNomEntreprise] = useState('');
    const [slogan, setSlogan] = useState('');
    const [bio, setBio] = useState('');
    const [experience, setExperience] = useState('');
    const [numeroIfu, setNumeroIfu] = useState('');
    const [ville, setVille] = useState('');
    const [zoneKm, setZoneKm] = useState(5);
    const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [urgences, setUrgences] = useState(false);
    const [weekend, setWeekend] = useState(false);
    const [horaires, setHoraires] = useState<HoraireTravail[]>(HORAIRES_DEFAUT);
    const [metiersSel, setMetiersSel] = useState<MetierEdit[]>([]);
    const [photoProfil, setPhotoProfil] = useState<string | null>(null);
    const [photoCouverture, setPhotoCouverture] = useState<string | null>(null);
    const [uploading, setUploading] = useState<'profil' | 'couverture' | null>(null);
    const [locating, setLocating] = useState(false);
    const initialized = useRef(false);

    useEffect(() => {
        if (!me || initialized.current) return;
        initialized.current = true;
        setNomEntreprise(me.nomEntreprise ?? '');
        setSlogan(me.slogan ?? '');
        setBio(me.bio ?? '');
        setExperience(me.anneesExperience ? String(me.anneesExperience) : '');
        setNumeroIfu(me.numeroIfu ?? '');
        setVille(me.villePrincipale ?? '');
        setZoneKm(Math.round(Number(me.zoneInterventionKm ?? 5)));
        if (me.latitude != null && me.longitude != null) {
            setCoords({ latitude: Number(me.latitude), longitude: Number(me.longitude) });
        }
        setUrgences(me.accepteUrgences);
        setWeekend(me.accepteWeekend);
        if (Array.isArray(me.horairesTravail) && me.horairesTravail.length > 0) {
            // Réaligne sur les 7 jours pour tolérer des données partielles
            setHoraires(
                JOURS.map(
                    (jour) =>
                        (me.horairesTravail as HoraireTravail[]).find((h) => h.jour === jour) ??
                        HORAIRES_DEFAUT.find((h) => h.jour === jour)!,
                ),
            );
        }
        setMetiersSel(
            (me.metiers ?? []).map((m) => ({
                metierId: m.metier.id,
                nom: m.metier.nom,
                estPrincipal: m.estPrincipal,
            })),
        );
        // Une info saisie UNE fois : à défaut de photo pro, celle du compte
        setPhotoProfil(me.photoProfilUrl ?? userPhoto ?? null);
        setPhotoCouverture(me.photoCouvertureUrl ?? null);
    }, [me]);

    // ─── Photos : choisir puis envoyer sur le CDN tout de suite ──────────────
    const pickPhoto = async (kind: 'profil' | 'couverture') => {
        suppressLock(); // la galerie met l'app en arrière-plan : pas d'empreinte au retour
        const picked = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.75,
            allowsEditing: true,
            aspect: kind === 'profil' ? [1, 1] : [16, 7],
        });
        if (picked.canceled || !picked.assets?.[0]) return;
        setUploading(kind);
        try {
            const form = new FormData();
            form.append('file', {
                uri: picked.assets[0].uri,
                name: kind === 'profil' ? 'pro-profil.jpg' : 'pro-couverture.jpg',
                type: 'image/jpeg',
            } as unknown as Blob);
            const { data } = await api.post<{ url: string }>('/upload/image?folder=profils', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 60000,
            });
            if (kind === 'profil') setPhotoProfil(data.url);
            else setPhotoCouverture(data.url);
        } catch (e) {
            Alert.alert('Envoi impossible', e instanceof ApiError ? e.message : 'Réessayez.');
        } finally {
            setUploading(null);
        }
    };

    const useMyLocation = async () => {
        setLocating(true);
        const pos = await resolvePosition();
        setLocating(false);
        if (!pos) {
            Alert.alert(
                'Position requise',
                'Votre position permet aux clients proches de vous trouver.',
            );
            return;
        }
        setCoords({ latitude: pos.latitude, longitude: pos.longitude });
        // ANTI-FRAUDE : la ville suit la position réelle, jamais la saisie libre
        if (pos.ville) setVille(pos.ville);
    };

    // ─── Métiers ──────────────────────────────────────────────────────────────
    const toggleMetier = (m: Metier) => {
        setMetiersSel((prev) => {
            const exists = prev.find((x) => x.metierId === m.id);
            if (exists) {
                const next = prev.filter((x) => x.metierId !== m.id);
                // Toujours garder un principal
                if (exists.estPrincipal && next.length > 0) next[0].estPrincipal = true;
                return [...next];
            }
            // Norme : 1 métier principal + 2 secondaires maximum
            if (prev.length >= 3) {
                Alert.alert(
                    'Trois métiers maximum',
                    'Un métier principal et deux secondaires : retirez-en un pour en ajouter un autre.',
                );
                return prev;
            }
            return [...prev, { metierId: m.id, nom: m.nom, estPrincipal: prev.length === 0 }];
        });
    };

    const setPrincipal = (metierId: string) => {
        setMetiersSel((prev) =>
            prev.map((x) => ({ ...x, estPrincipal: x.metierId === metierId })),
        );
    };

    // ─── Horaires ─────────────────────────────────────────────────────────────
    const setJour = (jour: string, patch: Partial<HoraireTravail>) => {
        setHoraires((prev) => prev.map((h) => (h.jour === jour ? { ...h, ...patch } : h)));
    };

    // ─── Enregistrement ───────────────────────────────────────────────────────
    const save = async () => {
        if (!ville.trim()) {
            Alert.alert(
                'Ville requise',
                'Touchez « Mettre à jour ma position » : votre ville en découle automatiquement.',
            );
            return;
        }
        if (metiersSel.length === 0) {
            Alert.alert('Métier requis', 'Sélectionnez au moins un métier.');
            return;
        }
        const heureOk = /^([01]?\d|2[0-3]):[0-5]\d$/;
        for (const h of horaires) {
            if (h.ouvert && (!heureOk.test(h.ouverture) || !heureOk.test(h.fermeture))) {
                Alert.alert(
                    'Horaires invalides',
                    `Vérifiez les heures du ${h.jour} (format 08:00).`,
                );
                return;
            }
        }
        try {
            await updateProfile.mutateAsync({
                nomEntreprise: nomEntreprise.trim() || undefined,
                slogan: slogan.trim() || undefined,
                bio: bio.trim() || undefined,
                anneesExperience: experience ? Number(experience) : undefined,
                numeroIfu: numeroIfu.trim() || undefined,
                villePrincipale: ville.trim(),
                zoneInterventionKm: zoneKm,
                latitude: coords?.latitude,
                longitude: coords?.longitude,
                accepteUrgences: urgences,
                accepteWeekend: weekend,
                horairesTravail: horaires,
                photoProfilUrl: photoProfil ?? undefined,
                photoCouvertureUrl: photoCouverture ?? undefined,
            });
            await updateMetiers.mutateAsync(
                metiersSel.map((m) => ({
                    metierId: m.metierId,
                    estPrincipal: m.estPrincipal,
                })),
            );
            Alert.alert('Profil enregistré ✓', 'Vos informations sont à jour.', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (e) {
            Alert.alert(
                'Enregistrement impossible',
                e instanceof ApiError ? e.message : 'Réessayez plus tard.',
            );
        }
    };

    if (isLoading && !me) {
        return (
            <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
                <Skeleton height={120} borderRadius={radii.lg} />
                <Skeleton height={200} borderRadius={radii.lg} />
                <Skeleton height={160} borderRadius={radii.lg} />
            </View>
        );
    }

    const saving = updateProfile.isPending || updateMetiers.isPending;

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {/* Photos */}
                <View>
                    <Pressable
                        onPress={() => pickPhoto('couverture')}
                        style={styles.cover}
                        accessibilityRole="button"
                        accessibilityLabel="Changer la photo de couverture"
                    >
                        {photoCouverture ? (
                            <Image
                                source={{ uri: photoCouverture }}
                                style={StyleSheet.absoluteFill}
                                contentFit="cover"
                            />
                        ) : (
                            <Text style={styles.coverHint}>Ajouter une photo de couverture</Text>
                        )}
                        <View style={styles.coverBadge}>
                            {uploading === 'couverture' ? (
                                <ActivityIndicator size="small" color={colors.onPrimary} />
                            ) : (
                                <Camera size={15} color={colors.onPrimary} strokeWidth={2.2} />
                            )}
                        </View>
                    </Pressable>
                    <Pressable
                        onPress={() => pickPhoto('profil')}
                        style={styles.avatarWrap}
                        accessibilityRole="button"
                        accessibilityLabel="Changer la photo professionnelle"
                    >
                        {photoProfil ? (
                            <Image source={{ uri: photoProfil }} style={styles.avatar} contentFit="cover" />
                        ) : (
                            <View style={[styles.avatar, styles.avatarEmpty]}>
                                <Camera size={22} color={colors.textMuted} strokeWidth={2} />
                            </View>
                        )}
                        {uploading === 'profil' && (
                            <View style={styles.avatarLoading}>
                                <ActivityIndicator size="small" color={colors.onPrimary} />
                            </View>
                        )}
                    </Pressable>
                </View>

                {/* Identité */}
                <Text style={styles.sectionTitle}>Votre vitrine</Text>
                <Input
                    label="Nom de l'entreprise"
                    placeholder="Ex. : Plomberie Express Cotonou"
                    value={nomEntreprise}
                    onChangeText={setNomEntreprise}
                    maxLength={200}
                />
                <Input
                    label="Slogan"
                    placeholder="Ex. : Votre satisfaction, notre priorité"
                    value={slogan}
                    onChangeText={setSlogan}
                    maxLength={200}
                />
                <Input
                    label="Présentation"
                    placeholder="Votre parcours, vos spécialités, ce qui vous distingue…"
                    value={bio}
                    onChangeText={setBio}
                    multiline
                    numberOfLines={4}
                    style={{ minHeight: 90, textAlignVertical: 'top' }}
                    maxLength={2000}
                />
                <View style={styles.row2}>
                    <View style={{ flex: 1 }}>
                        <Input
                            label="Années d'expérience"
                            placeholder="Ex. : 8"
                            keyboardType="number-pad"
                            value={experience}
                            onChangeText={(v) => setExperience(v.replace(/\D/g, '').slice(0, 2))}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Input
                            label="Numéro IFU (optionnel)"
                            placeholder="3201234567890"
                            keyboardType="number-pad"
                            value={numeroIfu}
                            onChangeText={setNumeroIfu}
                            maxLength={50}
                        />
                    </View>
                </View>

                {/* Zone d'intervention */}
                <Text style={styles.sectionTitle}>Zone d'intervention</Text>
                <Card style={{ gap: spacing.md }}>
                    <Input
                        label="Ville principale"
                        placeholder="Mettez à jour votre position"
                        value={ville}
                        editable={false}
                        helper="Suit automatiquement votre position réelle : mettez à jour votre position pour la changer"
                    />
                    <View>
                        <Text style={styles.fieldLabel}>Rayon autour de votre position</Text>
                        <View style={styles.zoneRow}>
                            {ZONES_KM.map((km) => {
                                const on = zoneKm === km;
                                return (
                                    <Pressable
                                        key={km}
                                        onPress={() => setZoneKm(km)}
                                        style={[styles.zoneChip, on && styles.zoneChipOn]}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected: on }}
                                    >
                                        <Text
                                            style={[
                                                styles.zoneChipText,
                                                on && { color: colors.onPrimary },
                                            ]}
                                        >
                                            {km} km
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                        <Text style={styles.helper}>
                            Les clients situés au-delà de ce rayon ne vous verront pas dans la
                            recherche à proximité.
                        </Text>
                    </View>
                    <Pressable onPress={useMyLocation} style={styles.locateButton} accessibilityRole="button">
                        <LocateFixed
                            size={15}
                            color={coords ? colors.success : colors.primary}
                            strokeWidth={2}
                        />
                        <Text style={[styles.locateText, coords != null && { color: colors.success }]}>
                            {locating
                                ? 'Localisation…'
                                : coords
                                  ? 'Position à jour ✓ (toucher pour actualiser)'
                                  : 'Mettre à jour ma position'}
                        </Text>
                    </Pressable>
                    {coords && (
                        <LiveMap point={coords} rounded style={{ height: 140 }} />
                    )}
                </Card>

                {/* Métiers — pas de tarifs : le prix se discute avec le client */}
                <Text style={styles.sectionTitle}>Mes métiers</Text>
                <View style={styles.metierWrap}>
                    {(metiersDispo ?? []).map((m) => {
                        const on = metiersSel.some((x) => x.metierId === m.id);
                        return (
                            <Pressable
                                key={m.id}
                                onPress={() => toggleMetier(m)}
                                style={[styles.metierChip, on && styles.metierChipOn]}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: on }}
                            >
                                <Text style={[styles.metierChipText, on && { color: colors.onPrimary }]}>
                                    {m.nom}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
                {metiersSel.length > 0 && (
                    <Card style={{ gap: spacing.sm }}>
                        {metiersSel.map((m) => (
                            <View key={m.metierId} style={styles.metierRow}>
                                <Pressable
                                    onPress={() => setPrincipal(m.metierId)}
                                    hitSlop={8}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected: m.estPrincipal }}
                                    accessibilityLabel={`Définir ${m.nom} comme métier principal`}
                                >
                                    <Star
                                        size={18}
                                        color={m.estPrincipal ? '#F59E0B' : colors.border}
                                        fill={m.estPrincipal ? '#F59E0B' : 'transparent'}
                                        strokeWidth={2}
                                    />
                                </Pressable>
                                <Text style={styles.metierRowName} numberOfLines={1}>
                                    {m.nom}
                                </Text>
                            </View>
                        ))}
                        <Text style={styles.helper}>
                            L'étoile désigne votre métier principal, mis en avant sur votre fiche.
                            Les prix se discutent directement avec vos clients.
                        </Text>
                    </Card>
                )}

                {/* Disponibilités */}
                <Text style={styles.sectionTitle}>Disponibilités</Text>
                <Card style={styles.switchCard}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.switchTitle}>⚡ J'accepte les urgences</Text>
                        <Text style={styles.switchText}>
                            Interventions en moins d'une heure, plus de demandes
                        </Text>
                    </View>
                    <Switch
                        value={urgences}
                        onValueChange={setUrgences}
                        trackColor={{ true: colors.primary, false: colors.border }}
                        thumbColor={colors.surface}
                    />
                </Card>
                <Card style={styles.switchCard}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.switchTitle}>📅 Je travaille le week-end</Text>
                    </View>
                    <Switch
                        value={weekend}
                        onValueChange={setWeekend}
                        trackColor={{ true: colors.primary, false: colors.border }}
                        thumbColor={colors.surface}
                    />
                </Card>
                <Card style={{ gap: spacing.sm }}>
                    <View style={styles.horairesHeader}>
                        <Clock3 size={15} color={colors.primary} strokeWidth={2.2} />
                        <Text style={styles.switchTitle}>Mes horaires</Text>
                    </View>
                    {horaires.map((h) => (
                        <View key={h.jour} style={styles.horaireRow}>
                            <Switch
                                value={h.ouvert}
                                onValueChange={(v) => setJour(h.jour, { ouvert: v })}
                                trackColor={{ true: colors.primary, false: colors.border }}
                                thumbColor={colors.surface}
                                style={styles.horaireSwitch}
                            />
                            <Text style={[styles.horaireJour, !h.ouvert && { color: colors.textMuted }]}>
                                {h.jour.charAt(0).toUpperCase() + h.jour.slice(1)}
                            </Text>
                            {h.ouvert ? (
                                <View style={styles.horaireInputs}>
                                    <TextInput
                                        value={h.ouverture}
                                        onChangeText={(v) => setJour(h.jour, { ouverture: v })}
                                        placeholder="08:00"
                                        placeholderTextColor={colors.textMuted}
                                        style={styles.heureInput}
                                        maxLength={5}
                                        keyboardType="numbers-and-punctuation"
                                    />
                                    <Text style={styles.heureSep}>à</Text>
                                    <TextInput
                                        value={h.fermeture}
                                        onChangeText={(v) => setJour(h.jour, { fermeture: v })}
                                        placeholder="18:00"
                                        placeholderTextColor={colors.textMuted}
                                        style={styles.heureInput}
                                        maxLength={5}
                                        keyboardType="numbers-and-punctuation"
                                    />
                                </View>
                            ) : (
                                <Text style={styles.horaireFerme}>Fermé</Text>
                            )}
                        </View>
                    ))}
                </Card>

                <Button title="Enregistrer" size="lg" fullWidth loading={saving} onPress={save} />

                <View style={styles.footNote}>
                    <MapPin size={14} color={colors.textMuted} strokeWidth={2} />
                    <Text style={styles.footNoteText}>
                        Votre position exacte n'est jamais montrée aux clients : seuls la ville et
                        le rayon d'intervention sont publics.
                    </Text>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
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
        gap: spacing.md,
    },
    cover: {
        height: 120,
        borderRadius: radii.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    coverHint: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.textMuted,
    },
    coverBadge: {
        position: 'absolute',
        right: spacing.sm,
        bottom: spacing.sm,
        width: 30,
        height: 30,
        borderRadius: radii.full,
        backgroundColor: 'rgba(18,39,94,0.85)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarWrap: {
        marginTop: -34,
        marginLeft: spacing.lg,
        alignSelf: 'flex-start',
    },
    avatar: {
        width: 68,
        height: 68,
        borderRadius: radii.full,
        borderWidth: 3,
        borderColor: colors.background,
        backgroundColor: colors.surface,
    },
    avatarEmpty: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarLoading: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: radii.full,
        backgroundColor: 'rgba(18,39,94,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: {
        fontFamily: typography.heading,
        fontSize: fontSizes.base,
        color: colors.text,
        marginTop: spacing.md,
    },
    row2: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    fieldLabel: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    zoneRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    zoneChip: {
        paddingHorizontal: spacing.md,
        height: 34,
        justifyContent: 'center',
        borderRadius: radii.full,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
    },
    zoneChipOn: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    zoneChipText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
    helper: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 3,
        color: colors.textMuted,
        marginTop: spacing.xs,
    },
    locateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        alignSelf: 'flex-start',
    },
    locateText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.primary,
    },
    metierWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    metierChip: {
        paddingHorizontal: spacing.md,
        height: 36,
        justifyContent: 'center',
        borderRadius: radii.full,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    metierChipOn: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    metierChipText: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
    metierRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    metierRowName: {
        flex: 1,
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    tarifInput: {
        width: 84,
        height: 38,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        paddingHorizontal: spacing.sm,
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.text,
        textAlign: 'right',
    },
    tarifUnit: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },
    switchCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    switchTitle: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.base,
        color: colors.text,
    },
    switchText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    horairesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    horaireRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    horaireSwitch: {
        transform: [{ scale: 0.8 }],
        marginLeft: -4,
    },
    horaireJour: {
        flex: 1,
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    horaireInputs: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    heureInput: {
        width: 62,
        height: 34,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        color: colors.text,
        textAlign: 'center',
        paddingVertical: 0,
    },
    heureSep: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },
    horaireFerme: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },
    footNote: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
    },
    footNoteText: {
        flex: 1,
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 3,
        color: colors.textMuted,
    },
});
