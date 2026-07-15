import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import {
    ArrowLeft,
    BadgeCheck,
    ChevronRight,
    Clock4,
    ContactRound,
    FileText,
    GraduationCap,
    LockOpen,
    Search,
    ShieldAlert,
    XCircle,
} from 'lucide-react-native';
import { ApiError } from '../../lib/api';
import { suppressLock } from '../../lib/lockGuard';
import { useAuth } from '../../stores/auth';
import { ImageViewer } from '../../components/ImageViewer';
import { Button, Card, EmptyState, Skeleton } from '../../components/ui';
import {
    useAdminSearchArtisans,
    useAdminArtisanDocuments,
    useUnlockCertification,
    type AdminCertification,
    type AdminUserResult,
} from '../../features/admin/hooks';
import { colors, palette, spacing, typography, fontSizes, lineHeights, radii } from '../../theme/tokens';

/**
 * Déverrouillage d'un document validé : quand un artisan appelle le support
 * pour modifier une pièce verrouillée, l'admin le retrouve ici (nom, email
 * ou téléphone), consulte ses documents et déverrouille celui demandé.
 */

export default function DeverrouillerScreen() {
    const router = useRouter();
    const isAdmin = useAuth((s) => s.status === 'authenticated' && s.user?.role === 'ADMIN');

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
                <Text style={styles.title}>Déverrouiller un document</Text>
                <View style={{ width: 38 }} />
            </View>
            {!isAdmin ? (
                <EmptyState
                    icon={<ShieldAlert size={30} color={colors.textMuted} strokeWidth={1.6} />}
                    title="Accès réservé"
                    message="Cet espace est réservé aux administrateurs de la plateforme."
                />
            ) : (
                <DeverrouillerContent />
            )}
        </SafeAreaView>
    );
}

function DeverrouillerContent() {
    const [search, setSearch] = useState('');
    const [artisan, setArtisan] = useState<AdminUserResult | null>(null);
    const [imageUri, setImageUri] = useState<string | null>(null);

    const { data: resultats, isLoading: searching } = useAdminSearchArtisans(search);
    const { data: documents, isLoading: loadingDocs } = useAdminArtisanDocuments(
        artisan?.artisan?.id ?? null,
    );
    const unlock = useUnlockCertification();

    const ouvrirDocument = (url: string | null | undefined) => {
        if (!url) return;
        if (url.toLowerCase().endsWith('.pdf')) {
            suppressLock();
            void WebBrowser.openBrowserAsync(url);
        } else {
            setImageUri(url);
        }
    };

    const deverrouiller = (c: AdminCertification) => {
        Alert.alert(
            'Déverrouiller ce document ?',
            `« ${c.titre} » repassera en attente d'examen et l'artisan pourra le modifier. Il sera notifié.`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Déverrouiller',
                    onPress: () =>
                        unlock.mutate(c.id, {
                            onError: (e) =>
                                Alert.alert(
                                    'Déverrouillage impossible',
                                    e instanceof ApiError ? e.message : 'Réessayez.',
                                ),
                        }),
                },
            ],
        );
    };

    const nomDe = (u: AdminUserResult) =>
        `${u.prenom ?? ''} ${u.nom ?? ''}`.trim() || u.email;

    return (
        <>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {/* Recherche de l'artisan */}
                <View style={styles.searchBar}>
                    <Search size={18} color={colors.textSecondary} strokeWidth={2} />
                    <TextInput
                        value={search}
                        onChangeText={(v) => {
                            setSearch(v);
                            setArtisan(null);
                        }}
                        placeholder="Nom, email ou téléphone de l'artisan…"
                        placeholderTextColor={colors.textMuted}
                        style={styles.searchInput}
                        autoCapitalize="none"
                    />
                    {search.length > 0 && (
                        <Pressable
                            onPress={() => {
                                setSearch('');
                                setArtisan(null);
                            }}
                            hitSlop={10}
                            accessibilityRole="button"
                            accessibilityLabel="Effacer"
                        >
                            <XCircle size={18} color={colors.textMuted} strokeWidth={2} />
                        </Pressable>
                    )}
                </View>

                {/* Résultats */}
                {!artisan && search.trim().length >= 2 && (
                    <View style={{ gap: spacing.sm }}>
                        {searching ? (
                            <Skeleton height={64} borderRadius={radii.md} />
                        ) : (resultats ?? []).length === 0 ? (
                            <Text style={styles.hint}>Aucun artisan trouvé.</Text>
                        ) : (
                            (resultats ?? []).map((u) => (
                                <Pressable
                                    key={u.id}
                                    onPress={() => setArtisan(u)}
                                    accessibilityRole="button"
                                >
                                    <Card style={styles.resultRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.resultNom}>{nomDe(u)}</Text>
                                            <Text style={styles.resultMeta} numberOfLines={1}>
                                                {u.email}
                                                {u.telephone ? ` · ${u.telephone}` : ''}
                                            </Text>
                                        </View>
                                        {u.artisan?.verified && (
                                            <BadgeCheck
                                                size={16}
                                                color={palette.green600}
                                                strokeWidth={2.2}
                                            />
                                        )}
                                        <ChevronRight
                                            size={16}
                                            color={colors.textMuted}
                                            strokeWidth={2.2}
                                        />
                                    </Card>
                                </Pressable>
                            ))
                        )}
                    </View>
                )}
                {!artisan && search.trim().length < 2 && (
                    <Text style={styles.hint}>
                        Quand un artisan demande à modifier un document validé (appel, WhatsApp…),
                        retrouvez-le ici puis déverrouillez la pièce concernée. Elle repassera en
                        attente d'examen.
                    </Text>
                )}

                {/* Documents de l'artisan sélectionné */}
                {artisan && (
                    <>
                        <Card style={styles.resultRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.resultNom}>{nomDe(artisan)}</Text>
                                <Text style={styles.resultMeta} numberOfLines={1}>
                                    {artisan.email}
                                    {artisan.telephone ? ` · ${artisan.telephone}` : ''}
                                </Text>
                            </View>
                            <Pressable
                                onPress={() => setArtisan(null)}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel="Changer d'artisan"
                            >
                                <XCircle size={18} color={colors.textMuted} strokeWidth={2} />
                            </Pressable>
                        </Card>

                        {loadingDocs ? (
                            <Skeleton height={90} borderRadius={radii.md} />
                        ) : (documents ?? []).length === 0 ? (
                            <Text style={styles.hint}>Cet artisan n'a envoyé aucun document.</Text>
                        ) : (
                            (documents ?? []).map((c) => (
                                <Card key={c.id} style={styles.docRow}>
                                    <Pressable
                                        onPress={() => ouvrirDocument(c.documentUrl)}
                                        accessibilityRole="button"
                                        accessibilityLabel="Voir le document"
                                    >
                                        {c.documentUrl &&
                                        !c.documentUrl.toLowerCase().endsWith('.pdf') ? (
                                            <Image
                                                source={{ uri: c.documentUrl }}
                                                style={styles.docThumb}
                                                contentFit="cover"
                                            />
                                        ) : (
                                            <View style={[styles.docThumb, styles.docThumbEmpty]}>
                                                <FileText
                                                    size={20}
                                                    color={colors.primary}
                                                    strokeWidth={2}
                                                />
                                            </View>
                                        )}
                                    </Pressable>
                                    <View style={{ flex: 1, gap: 2 }}>
                                        <View style={styles.docTitleRow}>
                                            {c.type === 'IDENTITE' ? (
                                                <ContactRound
                                                    size={13}
                                                    color={colors.primary}
                                                    strokeWidth={2.2}
                                                />
                                            ) : (
                                                <GraduationCap
                                                    size={13}
                                                    color={colors.accent}
                                                    strokeWidth={2.2}
                                                />
                                            )}
                                            <Text style={styles.docTitle} numberOfLines={1}>
                                                {c.titre}
                                            </Text>
                                        </View>
                                        {c.statutVerification === 'VALIDEE' ? (
                                            <Text style={[styles.docStatut, { color: palette.green700 }]}>
                                                Validé, verrouillé
                                            </Text>
                                        ) : c.statutVerification === 'REJETEE' ? (
                                            <Text style={[styles.docStatut, { color: palette.red700 }]}>
                                                Rejeté (chez l'artisan)
                                            </Text>
                                        ) : (
                                            <View style={styles.docTitleRow}>
                                                <Clock4
                                                    size={12}
                                                    color={palette.amber600}
                                                    strokeWidth={2.4}
                                                />
                                                <Text
                                                    style={[
                                                        styles.docStatut,
                                                        { color: palette.terracotta700 },
                                                    ]}
                                                >
                                                    En attente d'examen
                                                </Text>
                                            </View>
                                        )}
                                        {c.statutVerification === 'VALIDEE' && (
                                            <Button
                                                title="Déverrouiller"
                                                variant="secondary"
                                                size="sm"
                                                icon={
                                                    <LockOpen
                                                        size={13}
                                                        color={colors.primary}
                                                        strokeWidth={2.2}
                                                    />
                                                }
                                                loading={
                                                    unlock.isPending && unlock.variables === c.id
                                                }
                                                onPress={() => deverrouiller(c)}
                                                style={{ marginTop: spacing.xs, alignSelf: 'flex-start' }}
                                            />
                                        )}
                                    </View>
                                </Card>
                            ))
                        )}
                    </>
                )}
            </ScrollView>

            <ImageViewer uri={imageUri} visible={imageUri != null} onClose={() => setImageUri(null)} />
        </>
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
        paddingBottom: spacing['3xl'],
        gap: spacing.md,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        height: 48,
    },
    searchInput: {
        flex: 1,
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.text,
        height: '100%',
    },
    hint: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 4,
        color: colors.textMuted,
    },
    resultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    resultNom: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    resultMeta: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: 1,
    },
    docRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
    },
    docThumb: {
        width: 64,
        height: 64,
        borderRadius: radii.md,
        backgroundColor: colors.surfaceMuted,
    },
    docThumbEmpty: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    docTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    docTitle: {
        flex: 1,
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    docStatut: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
    },
});
