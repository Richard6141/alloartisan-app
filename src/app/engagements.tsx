import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    Alert,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Star, CheckCircle2, MessageCircle, HardHat } from 'lucide-react-native';
import { ApiError } from '../lib/api';
import {
    useMesEngagements,
    useTerminerMission,
    useDeposerAvisTravail,
    useStartTravailChat,
    type EngagementResume,
} from '../features/travailleurs/hooks';
import { Avatar, Button, Card, EmptyState, Skeleton } from '../components/ui';
import { colors, palette, spacing, typography, fontSizes, lineHeights, radii } from '../theme/tokens';

/**
 * Mes engagements (main-d'œuvre) : le patron et l'ouvrier retrouvent ici leurs
 * missions pour les CLÔTURER puis se NOTER mutuellement — la boucle qui crée la
 * réputation. (Backend : GET /travailleurs/engagements/mes.)
 */
export default function EngagementsScreen() {
    const router = useRouter();
    const { data, isLoading, refetch, isRefetching } = useMesEngagements();
    const terminer = useTerminerMission();
    const [noter, setNoter] = useState<EngagementResume | null>(null);

    const onTerminer = (e: EngagementResume) => {
        Alert.alert('Clôturer la mission', 'Confirmez que la mission est terminée.', [
            { text: 'Pas encore', style: 'cancel' },
            {
                text: 'Oui, terminée',
                onPress: () =>
                    terminer.mutate(e.id, {
                        onError: (err) =>
                            Alert.alert('Erreur', err instanceof ApiError ? err.message : 'Réessayez.'),
                    }),
            },
        ]);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.topBar}>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
                    <ArrowLeft size={20} color={colors.text} strokeWidth={2.2} />
                </Pressable>
                <Text style={styles.title}>Mes engagements</Text>
                <View style={{ width: 38 }} />
            </View>

            {isLoading && !data ? (
                <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
                    <Skeleton height={110} borderRadius={radii.lg} />
                    <Skeleton height={110} borderRadius={radii.lg} />
                </View>
            ) : !data || data.length === 0 ? (
                <EmptyState
                    icon={<HardHat size={30} color={colors.textMuted} strokeWidth={1.6} />}
                    title="Aucun engagement"
                    message="Quand vous embauchez un ouvrier (ou qu'un patron vous embauche), la mission apparaît ici pour la clôturer puis vous noter."
                />
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefetching}
                            onRefresh={() => void refetch()}
                            tintColor={colors.primary}
                        />
                    }
                >
                    {data.map((e) => (
                        <EngagementCard
                            key={e.id}
                            e={e}
                            terminerLoading={terminer.isPending && terminer.variables === e.id}
                            onTerminer={() => onTerminer(e)}
                            onNoter={() => setNoter(e)}
                        />
                    ))}
                </ScrollView>
            )}

            <AvisModal engagement={noter} onClose={() => setNoter(null)} />
        </SafeAreaView>
    );
}

function EngagementCard({
    e,
    terminerLoading,
    onTerminer,
    onNoter,
}: {
    e: EngagementResume;
    terminerLoading: boolean;
    onTerminer: () => void;
    onNoter: () => void;
}) {
    const router = useRouter();
    const startChat = useStartTravailChat();
    const roleTxt = e.role === 'PATRON' ? 'Vous l’avez embauché' : 'Vous a embauché';

    const discuter = () => {
        if (!e.autrePartie.userId) return;
        startChat.mutate(e.autrePartie.userId, {
            onSuccess: (conv) =>
                router.push({
                    pathname: '/conversation/[id]',
                    params: { id: conv.id, nom: e.autrePartie.nom },
                }),
        });
    };

    return (
        <Card style={styles.card}>
            <View style={styles.cardHead}>
                <Avatar name={e.autrePartie.nom} uri={e.autrePartie.photoUrl ?? undefined} size={46} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.nom} numberOfLines={1}>
                        {e.autrePartie.nom}
                    </Text>
                    <Text style={styles.role}>{roleTxt}</Text>
                </View>
                <View style={[styles.statutChip, e.statut === 'EN_COURS' ? styles.chipEnCours : styles.chipTermine]}>
                    <Text
                        style={[
                            styles.statutTxt,
                            { color: e.statut === 'EN_COURS' ? colors.primary : palette.green700 },
                        ]}
                    >
                        {e.statut === 'EN_COURS' ? 'En cours' : 'Terminée'}
                    </Text>
                </View>
            </View>

            <View style={styles.actions}>
                {e.autrePartie.userId && (
                    <Button
                        title="Discuter"
                        variant="ghost"
                        size="sm"
                        icon={<MessageCircle size={15} color={colors.primary} strokeWidth={2.2} />}
                        onPress={discuter}
                        style={{ flex: 1 }}
                    />
                )}
                {e.statut === 'EN_COURS' ? (
                    <Button
                        title="Clôturer"
                        size="sm"
                        loading={terminerLoading}
                        onPress={onTerminer}
                        style={{ flex: 1 }}
                    />
                ) : e.jaiNote ? (
                    <View style={styles.avisEnvoye}>
                        <CheckCircle2 size={15} color={palette.green600} strokeWidth={2.2} />
                        <Text style={styles.avisEnvoyeTxt}>Avis envoyé</Text>
                    </View>
                ) : (
                    <Button
                        title="⭐ Noter"
                        variant="accent"
                        size="sm"
                        onPress={onNoter}
                        style={{ flex: 1 }}
                    />
                )}
            </View>
        </Card>
    );
}

function AvisModal({
    engagement,
    onClose,
}: {
    engagement: EngagementResume | null;
    onClose: () => void;
}) {
    const avis = useDeposerAvisTravail();
    const [note, setNote] = useState(0);
    const [commentaire, setCommentaire] = useState('');

    const submit = () => {
        if (!engagement || note < 1) {
            Alert.alert('Note requise', 'Touchez les étoiles pour noter.');
            return;
        }
        avis.mutate(
            { engagementId: engagement.id, note, commentaire: commentaire.trim() || undefined },
            {
                onSuccess: () => {
                    setNote(0);
                    setCommentaire('');
                    onClose();
                },
                onError: (e) =>
                    Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Réessayez.'),
            },
        );
    };

    return (
        <Modal visible={!!engagement} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <KeyboardAvoidingView
                style={styles.modalOverlay}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <Pressable style={styles.modalBackdrop} onPress={onClose} />
                <View style={styles.sheet}>
                    <View style={styles.handle} />
                    <Text style={styles.sheetTitle}>Noter {engagement?.autrePartie.nom}</Text>
                    <View style={styles.stars}>
                        {[1, 2, 3, 4, 5].map((n) => (
                            <Pressable key={n} onPress={() => setNote(n)} hitSlop={6}>
                                <Star
                                    size={38}
                                    color={palette.amber600}
                                    fill={n <= note ? palette.amber600 : 'transparent'}
                                    strokeWidth={2}
                                />
                            </Pressable>
                        ))}
                    </View>
                    <TextInput
                        value={commentaire}
                        onChangeText={setCommentaire}
                        placeholder="Un mot sur la collaboration (optionnel)"
                        placeholderTextColor={colors.textMuted}
                        style={styles.input}
                        multiline
                        maxLength={500}
                    />
                    <Button
                        title="Envoyer mon avis"
                        size="lg"
                        fullWidth
                        loading={avis.isPending}
                        onPress={submit}
                    />
                </View>
            </KeyboardAvoidingView>
        </Modal>
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
    content: { paddingHorizontal: spacing.xl, paddingBottom: spacing['3xl'], gap: spacing.md },
    card: { gap: spacing.md },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    nom: { fontFamily: typography.bodyBold, fontSize: fontSizes.base, color: colors.text },
    role: { fontFamily: typography.body, fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 1 },
    statutChip: { borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: 4 },
    chipEnCours: { backgroundColor: colors.primarySoft },
    chipTermine: { backgroundColor: colors.successSoft },
    statutTxt: { fontFamily: typography.bodySemiBold, fontSize: fontSizes.xs },
    actions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    avisEnvoye: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
    },
    avisEnvoyeTxt: { fontFamily: typography.bodySemiBold, fontSize: fontSizes.sm, color: palette.green700 },
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: {
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
        padding: spacing.xl,
        paddingBottom: spacing['3xl'],
        gap: spacing.lg,
        alignItems: 'center',
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: radii.full,
        backgroundColor: colors.border,
    },
    sheetTitle: { fontFamily: typography.heading, fontSize: fontSizes.lg, color: colors.text },
    stars: { flexDirection: 'row', gap: spacing.sm },
    input: {
        alignSelf: 'stretch',
        minHeight: 70,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing.md,
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.text,
        textAlignVertical: 'top',
        lineHeight: lineHeights.sm + 2,
    },
});
