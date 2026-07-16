import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft,
    Megaphone,
    Plus,
    ChevronDown,
    ChevronUp,
    MessageCircle,
    Users,
    Star,
} from 'lucide-react-native';
import { EmptyState, Button, Spinner } from '../components/ui';
import {
    useMesAnnonces,
    useCandidats,
    useCloturerAnnonce,
} from '../features/travailleurs/annonces-hooks';
import { useStartTravailChat } from '../features/travailleurs/hooks';
import { useAuth } from '../stores/auth';
import { LoginInvite } from '../components/LoginInvite';
import { ApiError } from '../lib/api';
import type { AnnonceChantier, CandidatInteret } from '../types/api';
import { colors, palette, spacing, typography, fontSizes, radii } from '../theme/tokens';

const STATUT_META: Record<
    AnnonceChantier['statut'],
    { label: string; bg: string; fg: string }
> = {
    OUVERTE: { label: 'Ouverte', bg: colors.successSoft, fg: colors.success },
    POURVUE: { label: 'Pourvue', bg: colors.primarySoft, fg: colors.primary },
    CLOSE: { label: 'Fermée', bg: colors.border, fg: colors.textSecondary },
};

function CandidatRow({ candidat }: { candidat: CandidatInteret }) {
    const router = useRouter();
    const startChat = useStartTravailChat();
    const p = candidat.profil;
    const nom = `${p.user?.prenom ?? ''} ${p.user?.nom ?? ''}`.trim() || 'Travailleur';
    const metiers = (p.metiers ?? []).map((m) => m.metier?.nom).filter(Boolean).join(', ');

    const discuter = async () => {
        try {
            const conv = await startChat.mutateAsync(p.userId);
            router.push({ pathname: '/conversation/[id]', params: { id: conv.id, nom } });
        } catch (e) {
            Alert.alert('Impossible', e instanceof ApiError ? e.message : 'Réessayez.');
        }
    };

    return (
        <View style={styles.candidat}>
            <View style={{ flex: 1 }}>
                <Text style={styles.candidatNom}>{nom}</Text>
                <View style={styles.candidatMeta}>
                    {p.nombreAvis > 0 && (
                        <View style={styles.starRow}>
                            <Star size={11} color={colors.warning} fill={colors.warning} strokeWidth={0} />
                            <Text style={styles.candidatSub}>
                                {p.noteMoyenne.toFixed(1)} ({p.nombreAvis})
                            </Text>
                        </View>
                    )}
                    {metiers ? <Text style={styles.candidatSub}>{metiers}</Text> : null}
                </View>
                {candidat.message ? (
                    <Text style={styles.candidatMsg}>« {candidat.message} »</Text>
                ) : null}
            </View>
            <Pressable style={styles.chatBtn} onPress={discuter} hitSlop={8}>
                {startChat.isPending ? (
                    <Spinner size={18} color={palette.white} />
                ) : (
                    <MessageCircle size={18} color={palette.white} strokeWidth={2} />
                )}
            </Pressable>
        </View>
    );
}

function AnnonceRow({ annonce }: { annonce: AnnonceChantier }) {
    const [open, setOpen] = useState(false);
    const { data: candidats, isLoading } = useCandidats(annonce.id, open);
    const cloturer = useCloturerAnnonce();
    const nb = annonce._count?.interets ?? 0;
    const st = STATUT_META[annonce.statut];

    const onCloturer = () => {
        Alert.alert('Clôturer l’annonce', 'Que souhaitez-vous faire ?', [
            { text: 'Annuler', style: 'cancel' },
            {
                text: 'Chantier pourvu',
                onPress: () =>
                    cloturer.mutate({ annonceId: annonce.id, statut: 'POURVUE' }),
            },
            {
                text: 'Retirer l’annonce',
                style: 'destructive',
                onPress: () => cloturer.mutate({ annonceId: annonce.id, statut: 'CLOSE' }),
            },
        ]);
    };

    return (
        <View style={styles.card}>
            <View style={styles.cardHead}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                    {annonce.type === 'OUVRIER' ? 'Ouvrier' : 'Aide'}
                    {annonce.metier ? ` · ${annonce.metier.nom}` : ''} — {annonce.ville}
                </Text>
                <View style={[styles.statut, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statutTxt, { color: st.fg }]}>{st.label}</Text>
                </View>
            </View>

            <Text style={styles.cardDesc} numberOfLines={2}>
                {annonce.description}
            </Text>

            <Pressable style={styles.candidatsToggle} onPress={() => setOpen((o) => !o)}>
                <Users size={15} color={colors.primary} strokeWidth={2} />
                <Text style={styles.candidatsToggleTxt}>
                    {nb === 0 ? 'Aucun intéressé' : `${nb} intéressé${nb > 1 ? 's' : ''}`}
                </Text>
                {nb > 0 &&
                    (open ? (
                        <ChevronUp size={16} color={colors.textSecondary} strokeWidth={2} />
                    ) : (
                        <ChevronDown size={16} color={colors.textSecondary} strokeWidth={2} />
                    ))}
            </Pressable>

            {open && (
                <View style={styles.candidatsList}>
                    {isLoading ? (
                        <Spinner color={colors.primary} size={26} style={{ paddingVertical: spacing.md }} />
                    ) : !candidats || candidats.length === 0 ? (
                        <Text style={styles.emptyCandidats}>
                            Personne ne s’est encore manifesté.
                        </Text>
                    ) : (
                        candidats.map((c) => <CandidatRow key={c.id} candidat={c} />)
                    )}
                </View>
            )}

            {annonce.statut === 'OUVERTE' && (
                <Button
                    title="Clôturer"
                    variant="ghost"
                    size="sm"
                    onPress={onCloturer}
                    loading={cloturer.isPending}
                    style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
                />
            )}
        </View>
    );
}

export default function MesAnnoncesScreen() {
    const router = useRouter();
    const isAuth = useAuth((s) => s.status === 'authenticated');
    const { data, isLoading } = useMesAnnonces(isAuth);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={12}>
                    <ArrowLeft size={22} color={colors.text} strokeWidth={2} />
                </Pressable>
                <Text style={styles.title}>Mes annonces</Text>
                <Pressable
                    style={styles.addBtn}
                    onPress={() => router.push('/publier-annonce')}
                    hitSlop={8}
                >
                    <Plus size={18} color={palette.white} strokeWidth={2.4} />
                </Pressable>
            </View>

            {!isAuth ? (
                <LoginInvite
                    title="Mes annonces"
                    message="Connectez-vous pour gérer vos annonces de chantier et voir les candidats."
                />
            ) : isLoading ? (
                <View style={styles.loader}>
                    <Spinner color={colors.primary} size={30} />
                </View>
            ) : !data || data.length === 0 ? (
                <EmptyState
                    icon={<Megaphone size={44} color={colors.textMuted} strokeWidth={1.5} />}
                    title="Aucune annonce"
                    message="Publiez une annonce pour trouver des ouvriers ou des aides dans votre zone."
                    action={
                        <Button
                            title="Publier une annonce"
                            onPress={() => router.push('/publier-annonce')}
                        />
                    }
                />
            ) : (
                <ScrollView
                    contentContainerStyle={{
                        paddingHorizontal: spacing.xl,
                        paddingTop: spacing.md,
                        paddingBottom: spacing['3xl'],
                    }}
                    showsVerticalScrollIndicator={false}
                >
                    {data.map((a) => (
                        <AnnonceRow key={a.id} annonce={a} />
                    ))}
                </ScrollView>
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
    title: { flex: 1, fontFamily: typography.heading, fontSize: fontSizes.xl, color: colors.text },
    addBtn: {
        width: 34,
        height: 34,
        borderRadius: radii.full,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    card: {
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    cardHead: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        marginBottom: spacing.xs,
    },
    cardTitle: {
        flex: 1,
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.md,
        color: colors.text,
    },
    statut: { paddingVertical: 3, paddingHorizontal: spacing.sm, borderRadius: radii.full },
    statutTxt: { fontFamily: typography.bodySemiBold, fontSize: fontSizes.xs },
    cardDesc: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        lineHeight: 19,
    },
    candidatsToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: spacing.md,
    },
    candidatsToggleTxt: {
        flex: 1,
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.primary,
    },
    candidatsList: {
        marginTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: spacing.sm,
        gap: spacing.sm,
    },
    emptyCandidats: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.textMuted,
        paddingVertical: spacing.sm,
    },
    candidat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.background,
        borderRadius: radii.md,
        padding: spacing.md,
    },
    candidatNom: { fontFamily: typography.bodySemiBold, fontSize: fontSizes.sm, color: colors.text },
    candidatMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 2 },
    starRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    candidatSub: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
    candidatMsg: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        fontStyle: 'italic',
        marginTop: 4,
    },
    chatBtn: {
        width: 38,
        height: 38,
        borderRadius: radii.full,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
