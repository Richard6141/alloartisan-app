import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    TextInput,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Star } from 'lucide-react-native';
import { api, ApiError } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { Button, Card } from '../../components/ui';
import { colors, spacing, typography, fontSizes, lineHeights, radii } from '../../theme/tokens';

const NOTE_LABELS = ['', 'Décevant', 'Moyen', 'Bien', 'Très bien', 'Excellent !'];

/**
 * Noter l'artisan après une intervention TERMINÉE.
 * Règles garanties par le back : client propriétaire uniquement, un seul
 * avis par réservation, dans les 14 jours.
 */
export default function NoterScreen() {
    const { bookingId, nom } = useLocalSearchParams<{ bookingId: string; nom?: string }>();
    const router = useRouter();
    const queryClient = useQueryClient();

    const [note, setNote] = useState(0);
    const [ponctualite, setPonctualite] = useState(0);
    const [qualite, setQualite] = useState(0);
    const [communication, setCommunication] = useState(0);
    const [commentaire, setCommentaire] = useState('');

    const submitAvis = useMutation({
        mutationFn: async () => {
            const { data } = await api.post('/avis', {
                bookingId,
                note,
                notePonctualite: ponctualite || undefined,
                noteQualite: qualite || undefined,
                noteCommunication: communication || undefined,
                commentaire: commentaire.trim() || undefined,
            });
            return data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.booking(bookingId) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
            Alert.alert(
                'Merci ! ⭐',
                'Votre avis aide toute la communauté à choisir les meilleurs artisans.',
                [{ text: 'Fermer', onPress: () => router.back() }],
            );
        },
        onError: (e) =>
            Alert.alert('Envoi impossible', e instanceof ApiError ? e.message : 'Réessayez.'),
    });

    const submit = () => {
        if (note === 0) {
            Alert.alert('Note requise', 'Touchez les étoiles pour donner votre note globale.');
            return;
        }
        submitAvis.mutate();
    };

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
                <Text style={styles.title}>Votre avis</Text>
                <View style={{ width: 38 }} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text style={styles.subtitle}>
                        Comment s'est passée l'intervention{nom ? ` de ${nom}` : ''} ?
                    </Text>

                    {/* Note globale — grandes étoiles */}
                    <View style={styles.mainStars}>
                        <StarRow value={note} onChange={setNote} size={42} />
                        <Text style={styles.noteLabel}>{NOTE_LABELS[note] || ' '}</Text>
                    </View>

                    {/* Sous-notes optionnelles */}
                    <Card style={{ gap: spacing.lg }}>
                        <SubRating label="Ponctualité" value={ponctualite} onChange={setPonctualite} />
                        <SubRating label="Qualité du travail" value={qualite} onChange={setQualite} />
                        <SubRating
                            label="Communication"
                            value={communication}
                            onChange={setCommunication}
                        />
                    </Card>

                    {/* Commentaire */}
                    <View>
                        <Text style={styles.fieldLabel}>Votre commentaire (optionnel)</Text>
                        <TextInput
                            style={styles.commentInput}
                            placeholder="Racontez : ponctualité, propreté, résultat… Votre retour aide les prochains clients."
                            placeholderTextColor={colors.textMuted}
                            value={commentaire}
                            onChangeText={setCommentaire}
                            multiline
                            maxLength={1000}
                            accessibilityLabel="Commentaire"
                        />
                        <Text style={styles.charCount}>{commentaire.length}/1000</Text>
                    </View>

                    <Button
                        title="Publier mon avis"
                        size="lg"
                        fullWidth
                        loading={submitAvis.isPending}
                        onPress={submit}
                    />
                    <Text style={styles.disclaimer}>
                        Seuls les clients ayant réellement terminé une intervention peuvent noter :
                        votre avis sera affiché comme vérifié.
                    </Text>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function StarRow({
    value,
    onChange,
    size = 28,
}: {
    value: number;
    onChange: (v: number) => void;
    size?: number;
}) {
    return (
        <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((i) => (
                <Pressable
                    key={i}
                    onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onChange(i);
                    }}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`${i} étoile${i > 1 ? 's' : ''}`}
                >
                    <Star
                        size={size}
                        color="#F59E0B"
                        fill={i <= value ? '#F59E0B' : 'transparent'}
                        strokeWidth={i <= value ? 0 : 1.6}
                    />
                </Pressable>
            ))}
        </View>
    );
}

function SubRating({
    label,
    value,
    onChange,
}: {
    label: string;
    value: number;
    onChange: (v: number) => void;
}) {
    return (
        <View style={styles.subRating}>
            <Text style={styles.subLabel}>{label}</Text>
            <StarRow value={value} onChange={onChange} size={22} />
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
    content: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing['4xl'],
        gap: spacing.xl,
    },
    subtitle: {
        fontFamily: typography.headingMedium,
        fontSize: fontSizes.lg,
        lineHeight: lineHeights.lg,
        color: colors.text,
        textAlign: 'center',
        letterSpacing: -0.3,
    },
    mainStars: {
        alignItems: 'center',
        gap: spacing.sm,
    },
    starRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    noteLabel: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.base,
        color: colors.accent,
        minHeight: 22,
    },
    subRating: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
    },
    subLabel: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    fieldLabel: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    commentInput: {
        backgroundColor: colors.surface,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        minHeight: 110,
        textAlignVertical: 'top',
        fontFamily: typography.body,
        fontSize: fontSizes.base,
        color: colors.text,
    },
    charCount: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs - 1,
        color: colors.textMuted,
        alignSelf: 'flex-end',
        marginTop: spacing.xs,
    },
    disclaimer: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 3,
        color: colors.textMuted,
        textAlign: 'center',
    },
});
