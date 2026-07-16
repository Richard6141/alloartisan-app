import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { X, Sparkles } from 'lucide-react-native';
import { api, ApiError } from '../lib/api';
import { Button, Input } from './ui';
import type { Metier } from '../types/api';
import { colors, spacing, typography, fontSizes, lineHeights, radii } from '../theme/tokens';

type Categorie = { id: string; nom: string };

/**
 * Feuille « Mon métier n'est pas dans la liste ».
 *
 * L'artisan saisit le nom de son métier et choisit la catégorie la plus
 * proche. Le métier est créé côté serveur « en attente de validation »
 * (invisible des clients) mais l'artisan peut s'y rattacher immédiatement et
 * finir son inscription. Un administrateur validera ensuite le métier.
 */
export function SuggestMetierSheet({
    visible,
    onClose,
    categories,
    onCreated,
}: {
    visible: boolean;
    onClose: () => void;
    /** Catégories proposées (dérivées des métiers déjà chargés). */
    categories: Categorie[];
    /** Appelé avec le métier créé/réutilisé pour l'ajouter et le sélectionner. */
    onCreated: (metier: Metier) => void;
}) {
    const [nom, setNom] = useState('');
    const [categorieId, setCategorieId] = useState<string | null>(null);

    // Présélectionner l'unique catégorie quand il n'y en a qu'une
    const soleCategorie = categories.length === 1 ? categories[0].id : null;
    const selectedCategorie = categorieId ?? soleCategorie;

    const suggest = useMutation({
        mutationFn: async () => {
            const { data } = await api.post<Metier>('/metiers/suggest', {
                nom: nom.trim(),
                categorieId: selectedCategorie,
            });
            return data;
        },
        onSuccess: (metier) => {
            onCreated(metier);
            setNom('');
            setCategorieId(null);
            onClose();
        },
        onError: (e) =>
            Alert.alert(
                'Envoi impossible',
                e instanceof ApiError ? e.message : 'Réessayez dans un instant.',
            ),
    });

    const canSubmit = nom.trim().length >= 2 && !!selectedCategorie;

    const submit = () => {
        if (nom.trim().length < 2) {
            Alert.alert('Nom du métier', 'Indiquez le nom de votre métier (2 caractères min.).');
            return;
        }
        if (!selectedCategorie) {
            Alert.alert('Catégorie', 'Choisissez la catégorie la plus proche de votre métier.');
            return;
        }
        suggest.mutate();
    };

    const catList = useMemo(
        () => categories.slice().sort((a, b) => a.nom.localeCompare(b.nom)),
        [categories],
    );

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Zone tactile pour fermer en touchant l'arrière-plan */}
                <Pressable style={styles.backdrop} onPress={onClose} />

                <View style={styles.sheet}>
                    <View style={styles.handle} />

                    <View style={styles.header}>
                        <View style={styles.titleRow}>
                            <View style={styles.iconBadge}>
                                <Sparkles size={16} color={colors.primary} strokeWidth={2.2} />
                            </View>
                            <Text style={styles.title}>Votre métier n'est pas listé ?</Text>
                        </View>
                        <Pressable
                            onPress={onClose}
                            hitSlop={12}
                            style={styles.closeBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Fermer"
                        >
                            <X size={18} color={colors.textSecondary} strokeWidth={2.2} />
                        </Pressable>
                    </View>

                    <ScrollView
                        contentContainerStyle={styles.content}
                        keyboardShouldPersistTaps="handled"
                    >
                        <Text style={styles.intro}>
                            Proposez-le : vous pourrez l'utiliser tout de suite. Notre équipe le
                            vérifiera avant de le rendre visible des clients.
                        </Text>

                        <Input
                            label="Nom de votre métier"
                            placeholder="Ex. : Poseur de panneaux solaires"
                            value={nom}
                            onChangeText={setNom}
                            autoFocus
                            maxLength={100}
                        />

                        <View>
                            <Text style={styles.fieldLabel}>Catégorie la plus proche</Text>
                            <View style={styles.catWrap}>
                                {catList.map((c) => {
                                    const on = selectedCategorie === c.id;
                                    return (
                                        <Pressable
                                            key={c.id}
                                            onPress={() => setCategorieId(c.id)}
                                            accessibilityRole="radio"
                                            accessibilityState={{ selected: on }}
                                            style={[styles.catChip, on && styles.catChipOn]}
                                        >
                                            <Text
                                                style={[
                                                    styles.catChipText,
                                                    on && { color: colors.onPrimary },
                                                ]}
                                            >
                                                {c.nom}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>

                        <Button
                            title="Proposer ce métier"
                            size="lg"
                            fullWidth
                            loading={suggest.isPending}
                            disabled={!canSubmit}
                            onPress={submit}
                            style={{ marginTop: spacing.md }}
                        />
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(10,18,42,0.45)',
    },
    sheet: {
        backgroundColor: colors.background,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        paddingBottom: spacing['3xl'],
        maxHeight: '88%',
    },
    handle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: radii.full,
        backgroundColor: colors.border,
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.sm,
        paddingBottom: spacing.md,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1,
    },
    iconBadge: {
        width: 30,
        height: 30,
        borderRadius: radii.full,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        flex: 1,
        fontFamily: typography.heading,
        fontSize: fontSizes.base,
        color: colors.text,
        letterSpacing: -0.2,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: radii.full,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        paddingHorizontal: spacing.xl,
        gap: spacing.lg,
    },
    intro: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        lineHeight: lineHeights.sm + 3,
        color: colors.textSecondary,
    },
    fieldLabel: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    catWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    catChip: {
        paddingHorizontal: spacing.md,
        height: 36,
        justifyContent: 'center',
        borderRadius: radii.full,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    catChipOn: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    catChipText: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
});
