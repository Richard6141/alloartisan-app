import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    Alert,
    TextInput,
    useWindowDimensions,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { ArrowLeft, Camera, ImagePlus, Images, Plus, Trash2, XCircle } from 'lucide-react-native';
import { ApiError } from '../lib/api';
import { suppressLock } from '../lib/lockGuard';
import { useAuth } from '../stores/auth';
import { LoginInvite } from '../components/LoginInvite';
import { Button, Card, Skeleton, EmptyState } from '../components/ui';
import {
    useMyArtisanProfile,
    usePortfolio,
    useAddPortfolioPhoto,
    useDeletePortfolioItem,
    type LocalDocument,
} from '../features/artisan/hooks';
import { colors, spacing, typography, fontSizes, lineHeights, radii } from '../theme/tokens';

/**
 * Réalisations de l'artisan : la galerie qui vend son savoir-faire.
 * Sélection multiple, compression locale (les photos de téléphone font
 * souvent 5-10 Mo : on les ramène à ~300 Ko sans perte visible), légende
 * par photo, publication en série avec progression.
 */

/** Côté le plus long après compression : suffisant pour un plein écran mobile */
const MAX_DIMENSION = 1600;

interface PendingPhoto {
    key: string;
    doc: LocalDocument;
    caption: string;
}

export default function MesRealisationsScreen() {
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
                <Text style={styles.title}>Mes réalisations</Text>
                <View style={{ width: 38 }} />
            </View>
            {status !== 'authenticated' || !isArtisan ? (
                <LoginInvite
                    title="Espace artisan"
                    message="Connectez-vous avec un compte artisan pour gérer vos réalisations."
                />
            ) : (
                <RealisationsContent />
            )}
        </SafeAreaView>
    );
}

/** Compresse une photo : côté max 1600 px, JPEG qualité 75 % */
async function compressPhoto(asset: ImagePicker.ImagePickerAsset): Promise<LocalDocument> {
    const context = ImageManipulator.manipulate(asset.uri);
    const largest = Math.max(asset.width ?? 0, asset.height ?? 0);
    if (largest > MAX_DIMENSION) {
        if ((asset.width ?? 0) >= (asset.height ?? 0)) {
            context.resize({ width: MAX_DIMENSION });
        } else {
            context.resize({ height: MAX_DIMENSION });
        }
    }
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
    return { uri: saved.uri, name: 'realisation.jpg', mimeType: 'image/jpeg' };
}

function RealisationsContent() {
    const { width } = useWindowDimensions();
    const { data: me } = useMyArtisanProfile();
    const { data: portfolio, isLoading } = usePortfolio(me?.id);
    const addPhoto = useAddPortfolioPhoto(me?.id);
    const deleteItem = useDeletePortfolioItem(me?.id);

    const [pending, setPending] = useState<PendingPhoto[]>([]);
    const [preparing, setPreparing] = useState(false);
    const [publishProgress, setPublishProgress] = useState<{ done: number; total: number } | null>(
        null,
    );

    // 3 colonnes avec les marges de l'écran (padding xl de chaque côté + 2 gaps)
    const cell = Math.floor((width - spacing.xl * 2 - spacing.sm * 2) / 3);

    const placesRestantes = portfolio
        ? Math.max(0, portfolio.maxAllowed - portfolio.total - pending.length)
        : 0;

    const pick = async (fromCamera: boolean) => {
        suppressLock(); // galerie/caméra : pas de verrou empreinte au retour
        const picked = fromCamera
            ? await (async () => {
                  const perm = await ImagePicker.requestCameraPermissionsAsync();
                  if (!perm.granted) return null;
                  return ImagePicker.launchCameraAsync({ quality: 1 });
              })()
            : await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ['images'],
                  allowsMultipleSelection: true,
                  selectionLimit: placesRestantes,
                  quality: 1, // compression faite par nous, plus efficace
              });
        if (!picked || picked.canceled || picked.assets.length === 0) return;

        setPreparing(true);
        try {
            const prepared: PendingPhoto[] = [];
            // Séquentiel : compresser 10 photos de 10 Mo en parallèle sature la mémoire
            for (const asset of picked.assets.slice(0, placesRestantes || 1)) {
                const doc = await compressPhoto(asset);
                prepared.push({ key: `${asset.assetId ?? asset.uri}`, doc, caption: '' });
            }
            setPending((prev) => [...prev, ...prepared]);
        } catch {
            Alert.alert('Préparation impossible', 'Réessayez avec d\'autres photos.');
        } finally {
            setPreparing(false);
        }
    };

    const setCaption = (key: string, caption: string) => {
        setPending((prev) => prev.map((p) => (p.key === key ? { ...p, caption } : p)));
    };

    const removePending = (key: string) => {
        setPending((prev) => prev.filter((p) => p.key !== key));
    };

    const publishAll = async () => {
        const queue = [...pending];
        setPublishProgress({ done: 0, total: queue.length });
        try {
            for (let i = 0; i < queue.length; i++) {
                await addPhoto.mutateAsync({ photo: queue[i].doc, caption: queue[i].caption });
                setPending((prev) => prev.filter((p) => p.key !== queue[i].key));
                setPublishProgress({ done: i + 1, total: queue.length });
            }
        } catch (e) {
            Alert.alert(
                'Publication interrompue',
                e instanceof ApiError
                    ? `${e.message} Les photos restantes sont conservées, réessayez.`
                    : 'Les photos restantes sont conservées, réessayez.',
            );
        } finally {
            setPublishProgress(null);
        }
    };

    const confirmDelete = (url: string) => {
        Alert.alert('Supprimer cette photo ?', 'Elle disparaîtra de votre fiche publique.', [
            { text: 'Annuler', style: 'cancel' },
            {
                text: 'Supprimer',
                style: 'destructive',
                onPress: () =>
                    deleteItem.mutate(url, {
                        onError: (e) =>
                            Alert.alert(
                                'Suppression impossible',
                                e instanceof ApiError ? e.message : 'Réessayez.',
                            ),
                    }),
            },
        ]);
    };

    const items = portfolio?.items ?? [];
    const plein = portfolio != null && portfolio.total + pending.length >= portfolio.maxAllowed;
    const publishing = publishProgress != null;

    return (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.subtitle}>
                Montrez vos plus beaux chantiers : c'est la première chose que regardent les
                clients.{' '}
                {portfolio != null && (
                    <Text style={styles.counter}>
                        {portfolio.total}/{portfolio.maxAllowed} photos
                    </Text>
                )}
            </Text>

            {/* Sélection : plusieurs photos d'un coup */}
            {!plein && !publishing && (
                <View style={styles.addRow}>
                    <Pressable
                        onPress={() => void pick(false)}
                        style={styles.addButton}
                        disabled={preparing}
                        accessibilityRole="button"
                    >
                        <ImagePlus size={17} color={colors.primary} strokeWidth={2} />
                        <Text style={styles.addButtonText}>
                            {preparing
                                ? 'Préparation…'
                                : pending.length > 0
                                  ? 'En ajouter d\'autres'
                                  : 'Choisir des photos'}
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={() => void pick(true)}
                        style={[styles.addButton, { flex: 0, paddingHorizontal: spacing.lg }]}
                        disabled={preparing}
                        accessibilityRole="button"
                        accessibilityLabel="Prendre une photo"
                    >
                        <Camera size={17} color={colors.primary} strokeWidth={2} />
                    </Pressable>
                </View>
            )}
            {plein && pending.length === 0 && (
                <Text style={styles.fullNote}>
                    Galerie pleine : supprimez une photo pour en ajouter une nouvelle.
                </Text>
            )}

            {/* File d'attente : légende par photo puis publication groupée */}
            {pending.length > 0 && (
                <Card style={{ gap: spacing.md }}>
                    <Text style={styles.pendingTitle}>
                        {pending.length} photo{pending.length > 1 ? 's' : ''} à publier
                    </Text>
                    {pending.map((p) => (
                        <View key={p.key} style={styles.pendingRow}>
                            <Image
                                source={{ uri: p.doc.uri }}
                                style={styles.pendingThumb}
                                contentFit="cover"
                            />
                            <TextInput
                                value={p.caption}
                                onChangeText={(v) => setCaption(p.key, v)}
                                placeholder="Légende (optionnel)"
                                placeholderTextColor={colors.textMuted}
                                style={styles.captionInput}
                                maxLength={200}
                                editable={!publishing}
                            />
                            <Pressable
                                onPress={() => removePending(p.key)}
                                hitSlop={8}
                                disabled={publishing}
                                accessibilityRole="button"
                                accessibilityLabel="Retirer cette photo"
                            >
                                <XCircle size={20} color={colors.textMuted} strokeWidth={2} />
                            </Pressable>
                        </View>
                    ))}
                    <Button
                        title={
                            publishProgress
                                ? `Publication ${publishProgress.done}/${publishProgress.total}…`
                                : pending.length > 1
                                  ? `Publier les ${pending.length} photos`
                                  : 'Publier la photo'
                        }
                        fullWidth
                        loading={publishing}
                        onPress={() => void publishAll()}
                        icon={<Plus size={16} color={colors.onPrimary} strokeWidth={2.4} />}
                    />
                </Card>
            )}

            {/* Grille */}
            {isLoading ? (
                <View style={styles.grid}>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} width={cell} height={cell} borderRadius={radii.md} />
                    ))}
                </View>
            ) : items.length === 0 && pending.length === 0 ? (
                <EmptyState
                    icon={<Images size={30} color={colors.textMuted} strokeWidth={1.6} />}
                    title="Aucune réalisation"
                    message="Ajoutez des photos de vos chantiers terminés pour rassurer vos futurs clients."
                />
            ) : (
                <View style={styles.grid}>
                    {items.map((item) => (
                        <View key={item.url} style={{ width: cell }}>
                            <Image
                                source={{ uri: item.url }}
                                style={{ width: cell, height: cell, borderRadius: radii.md }}
                                contentFit="cover"
                                transition={150}
                            />
                            <Pressable
                                onPress={() => confirmDelete(item.url)}
                                style={styles.deleteBadge}
                                hitSlop={6}
                                accessibilityRole="button"
                                accessibilityLabel="Supprimer la photo"
                            >
                                <Trash2 size={13} color={colors.onPrimary} strokeWidth={2.2} />
                            </Pressable>
                            {!!item.caption && (
                                <Text style={styles.caption} numberOfLines={2}>
                                    {item.caption}
                                </Text>
                            )}
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>
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
    subtitle: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        lineHeight: lineHeights.sm + 3,
        color: colors.textSecondary,
    },
    counter: {
        fontFamily: typography.bodyBold,
        color: colors.primary,
    },
    addRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    addButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        height: 46,
        borderRadius: radii.md,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
    },
    addButtonText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.primary,
    },
    fullNote: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },
    pendingTitle: {
        fontFamily: typography.heading,
        fontSize: fontSizes.base,
        color: colors.text,
    },
    pendingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    pendingThumb: {
        width: 52,
        height: 52,
        borderRadius: radii.md,
        backgroundColor: colors.surfaceMuted,
    },
    captionInput: {
        flex: 1,
        height: 42,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        paddingHorizontal: spacing.md,
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    deleteBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 26,
        height: 26,
        borderRadius: radii.full,
        backgroundColor: 'rgba(15,23,42,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    caption: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs - 1,
        lineHeight: lineHeights.xs,
        color: colors.textSecondary,
        marginTop: 3,
    },
});
