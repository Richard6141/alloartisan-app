import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Star, ShieldCheck, MapPin, Hammer, HardHat, Gift } from 'lucide-react-native';
import { Avatar, Button, Skeleton } from '../../components/ui';
import {
    useTravailleurFiche,
    useEmbaucher,
    useTerminerMission,
    useDeposerAvisTravail,
    useStartTravailChat,
} from '../../features/travailleurs/hooks';
import { ApiError } from '../../lib/api';
import { colors, palette, spacing, typography, fontSizes, radii, shadows } from '../../theme/tokens';

export default function TravailleurDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { data: t, isLoading } = useTravailleurFiche(id);

    const embaucher = useEmbaucher();
    const terminer = useTerminerMission();
    const avis = useDeposerAvisTravail();
    const startChat = useStartTravailChat();

    const [engagementId, setEngagementId] = useState<string | null>(null);
    const [termine, setTermine] = useState(false);
    const [note, setNote] = useState(0);
    const [avisEnvoye, setAvisEnvoye] = useState(false);

    const err = (e: unknown) =>
        Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Réessayez.');

    const onEmbaucher = () => {
        if (!t) return;
        Alert.alert('Embaucher', `Confirmer l'embauche de ce ${t.type === 'OUVRIER' ? 'ouvrier' : 'aide'} ?`, [
            { text: 'Annuler', style: 'cancel' },
            {
                text: 'Oui, j\'embauche',
                onPress: () =>
                    embaucher.mutate(
                        { profilTravailleurId: t.id },
                        { onSuccess: (e) => setEngagementId(e.id), onError: err },
                    ),
            },
        ]);
    };

    const onDiscuter = () => {
        if (!t) return;
        startChat.mutate(t.userId, {
            onSuccess: (conv) =>
                router.push({ pathname: '/conversation/[id]', params: { id: conv.id, nom } }),
            onError: err,
        });
    };

    const onTerminer = () => {
        if (!engagementId) return;
        terminer.mutate(engagementId, { onSuccess: () => setTermine(true), onError: err });
    };

    const onAvis = () => {
        if (!engagementId || note < 1) return;
        avis.mutate(
            { engagementId, note },
            { onSuccess: () => setAvisEnvoye(true), onError: err },
        );
    };

    const nom =
        `${t?.user?.prenom ?? ''} ${t?.user?.nom ?? ''}`.trim() ||
        (t?.type === 'OUVRIER' ? 'Ouvrier' : 'Aide');
    const noteMoy = Number(t?.noteMoyenne) || 0;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={12}>
                    <ArrowLeft size={22} color={colors.text} strokeWidth={2} />
                </Pressable>
                <Text style={styles.headerTitle}>Profil</Text>
            </View>

            {isLoading || !t ? (
                <View style={{ padding: spacing.xl, gap: spacing.md }}>
                    <Skeleton width="60%" height={24} />
                    <Skeleton width="90%" height={80} borderRadius={radii.lg} />
                </View>
            ) : (
                <>
                    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                        <View style={styles.card}>
                            <Avatar name={nom} uri={t.user?.photoUrl ?? undefined} size={72} />
                            <View style={styles.nameRow}>
                                <Text style={styles.name}>{nom}</Text>
                                {t.identiteVerifiee && (
                                    <ShieldCheck size={18} color={colors.primary} strokeWidth={2.4} />
                                )}
                            </View>
                            <View style={styles.typeBadge}>
                                {t.type === 'OUVRIER' ? (
                                    <Hammer size={14} color={palette.terracotta700} strokeWidth={2.2} />
                                ) : (
                                    <HardHat size={14} color={palette.terracotta700} strokeWidth={2.2} />
                                )}
                                <Text style={styles.typeTxt}>
                                    {t.type === 'OUVRIER' ? 'Ouvrier qualifié' : 'Aide / manœuvre'}
                                </Text>
                            </View>
                            <View style={styles.metaRow}>
                                <Star size={14} color={palette.amber600} fill={palette.amber600} strokeWidth={0} />
                                <Text style={styles.meta}>
                                    {noteMoy > 0 ? `${noteMoy.toFixed(1)} (${t.nombreAvis})` : 'Nouveau'}
                                </Text>
                                <MapPin size={14} color={colors.textSecondary} strokeWidth={2} />
                                <Text style={styles.meta}>
                                    {t.villePrincipale}
                                    {t.distanceKm != null
                                        ? ` · ${t.distanceKm < 1 ? `${Math.round(t.distanceKm * 1000)} m` : `${t.distanceKm.toFixed(1)} km`}`
                                        : ''}
                                </Text>
                            </View>
                        </View>

                        {/* Infos */}
                        <View style={styles.block}>
                            <Row label="Compétences">
                                {t.polyvalent
                                    ? 'Polyvalent · tous chantiers'
                                    : (t.metiers ?? []).map((m) => m.metier?.nom).filter(Boolean).join(', ') || '—'}
                            </Row>
                            <Row label="Disponibilité">
                                {t.disponibilite === 'PONCTUEL' ? 'Ponctuel (journalier)' : 'Régulier'}
                                {t.disponibleMaintenant ? ' · dispo maintenant' : ''}
                            </Row>
                            {t.anneesExperience != null && (
                                <Row label="Expérience">{t.anneesExperience} an(s)</Row>
                            )}
                            {t.tarifJournalier != null && (
                                <Row label="Tarif indicatif">
                                    {t.tarifJournalier.toLocaleString('fr-FR')} F CFA / jour
                                </Row>
                            )}
                            {t.description ? <Row label="À propos">{t.description}</Row> : null}
                        </View>

                        <View style={styles.free}>
                            <Gift size={15} color={palette.green600} strokeWidth={2.2} />
                            <Text style={styles.freeTxt}>
                                Mise en relation gratuite. La rémunération se convient directement.
                            </Text>
                        </View>
                    </ScrollView>

                    {/* Actions */}
                    <View style={styles.actions}>
                        {!engagementId && (
                            <>
                                <Button
                                    title="Discuter"
                                    size="lg"
                                    fullWidth
                                    loading={startChat.isPending}
                                    onPress={onDiscuter}
                                />
                                <Button
                                    title="J'embauche ce travailleur"
                                    variant="secondary"
                                    fullWidth
                                    loading={embaucher.isPending}
                                    onPress={onEmbaucher}
                                />
                            </>
                        )}
                        {engagementId && !termine && (
                            <Button
                                title="Marquer la mission terminée"
                                size="lg"
                                variant="secondary"
                                fullWidth
                                loading={terminer.isPending}
                                onPress={onTerminer}
                            />
                        )}
                        {engagementId && termine && !avisEnvoye && (
                            <>
                                <Text style={styles.rateLabel}>Notez ce travailleur</Text>
                                <View style={styles.stars}>
                                    {[1, 2, 3, 4, 5].map((n) => (
                                        <Pressable key={n} onPress={() => setNote(n)} hitSlop={6}>
                                            <Star
                                                size={32}
                                                color={palette.amber600}
                                                fill={n <= note ? palette.amber600 : 'transparent'}
                                                strokeWidth={2}
                                            />
                                        </Pressable>
                                    ))}
                                </View>
                                <Button
                                    title="Envoyer l'avis"
                                    variant="accent"
                                    fullWidth
                                    disabled={note < 1}
                                    loading={avis.isPending}
                                    onPress={onAvis}
                                />
                            </>
                        )}
                        {avisEnvoye && <Text style={styles.done}>✅ Merci, votre avis est enregistré.</Text>}
                    </View>
                </>
            )}
        </SafeAreaView>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <View style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue}>{children}</Text>
        </View>
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
    headerTitle: { fontFamily: typography.heading, fontSize: fontSizes.xl, color: colors.text },
    content: { padding: spacing.xl, gap: spacing.md },
    card: { alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, ...shadows.card },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
    name: { fontFamily: typography.heading, fontSize: fontSizes.xl, color: colors.text },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: palette.terracotta100,
        paddingVertical: 4,
        paddingHorizontal: spacing.md,
        borderRadius: radii.full,
    },
    typeTxt: { fontFamily: typography.bodySemiBold, fontSize: fontSizes.xs, color: palette.terracotta700 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap', justifyContent: 'center' },
    meta: { fontFamily: typography.body, fontSize: fontSizes.sm, color: colors.textSecondary },
    block: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md, ...shadows.card },
    row: { gap: 2 },
    rowLabel: { fontFamily: typography.bodySemiBold, fontSize: fontSizes.xs, color: colors.textSecondary },
    rowValue: { fontFamily: typography.body, fontSize: fontSizes.base, color: colors.text, lineHeight: 22 },
    free: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: palette.green100, borderRadius: radii.lg, padding: spacing.md },
    freeTxt: { flex: 1, fontFamily: typography.body, fontSize: fontSizes.xs, color: colors.text },
    actions: {
        padding: spacing.xl,
        gap: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
    },
    rateLabel: { fontFamily: typography.bodySemiBold, fontSize: fontSizes.sm, color: colors.text, textAlign: 'center' },
    stars: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    done: { fontFamily: typography.bodySemiBold, fontSize: fontSizes.base, color: palette.green700, textAlign: 'center' },
});
