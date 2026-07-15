import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft,
    MapPin,
    CalendarDays,
    MessageCircle,
    Navigation,
    CheckCircle2,
    Handshake,
} from 'lucide-react-native';
import {
    useBooking,
    useBookingAction,
    useArtisanBookingActions,
} from '../../features/bookings/hooks';
import { useStartConversation } from '../../features/artisans/hooks';
import { useAuth } from '../../stores/auth';
import { Avatar, Badge, Button, Card, Skeleton } from '../../components/ui';
import { ApiError } from '../../lib/api';
import type { Booking, StatutBooking } from '../../types/api';
import { colors, spacing, typography, fontSizes, lineHeights, radii } from '../../theme/tokens';

const STATUS_META: Record<
    StatutBooking,
    { label: string; tone: 'primary' | 'success' | 'danger' | 'warning' | 'neutral' | 'accent'; description: string }
> = {
    SOUMISE: {
        label: 'En attente',
        tone: 'warning',
        description: "Votre demande a été envoyée. L'artisan répond en général sous quelques heures.",
    },
    ACCEPTEE: {
        label: 'Acceptée',
        tone: 'primary',
        description:
            "L'artisan a accepté votre demande. Confirmez le rendez-vous, puis discutez du prix directement avec lui.",
    },
    PRIX_PROPOSE: {
        label: 'Devis reçu',
        tone: 'accent',
        description: "Un prix vous a été proposé. Acceptez-le ou discutez-en avec l'artisan.",
    },
    CONTRE_OFFRE: {
        label: 'Négociation',
        tone: 'accent',
        description: 'Négociation du prix en cours.',
    },
    CONFIRMEE: {
        label: 'Confirmée',
        tone: 'primary',
        description:
            "Rendez-vous confirmé. Convenez du prix avec l'artisan et suivez-le en direct le jour J.",
    },
    EN_COURS: {
        label: 'En cours',
        tone: 'success',
        description: "L'intervention est en cours.",
    },
    TERMINEE: {
        label: 'Terminée',
        tone: 'neutral',
        description: 'Intervention terminée. Merci de laisser un avis !',
    },
    ANNULEE: {
        label: 'Annulée',
        tone: 'danger',
        description: 'Cette réservation a été annulée.',
    },
    LITIGE: {
        label: 'Litige',
        tone: 'danger',
        description: 'Un litige est en cours. Notre équipe vous contactera.',
    },
};

const TIMELINE_STEPS: StatutBooking[] = ['SOUMISE', 'ACCEPTEE', 'CONFIRMEE', 'EN_COURS', 'TERMINEE'];

/** Descriptions vues par l'ARTISAN (le client a les siennes dans STATUS_META) */
const ARTISAN_DESCRIPTIONS: Partial<Record<StatutBooking, string>> = {
    SOUMISE: 'Nouvelle demande ! Acceptez-la pour entrer en contact avec le client.',
    ACCEPTEE:
        'Vous avez accepté. En attente de la confirmation du client — profitez-en pour discuter du prix dans la messagerie.',
    PRIX_PROPOSE: 'Devis envoyé. En attente de la réponse du client.',
    CONTRE_OFFRE: 'Le client négocie. Discutez-en dans la messagerie.',
    CONFIRMEE:
        'Rendez-vous confirmé ! Le jour J, activez « Je pars » pour que le client vous suive.',
    EN_COURS: "Intervention en cours. Pensez à la clôturer une fois le travail terminé.",
    TERMINEE: 'Mission terminée. Le client peut maintenant vous noter.',
};

export default function BookingDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { data: booking, isLoading } = useBooking(id);
    const { confirm, cancel } = useBookingAction(id);
    const startConversation = useStartConversation();
    const isArtisan = useAuth((s) => s.user?.role === 'ARTISAN');

    const meta = booking ? STATUS_META[booking.statut] : null;
    const description =
        booking && isArtisan
            ? (ARTISAN_DESCRIPTIONS[booking.statut] ?? meta?.description)
            : meta?.description;
    const currentStep = booking ? TIMELINE_STEPS.indexOf(booking.statut) : -1;
    const trackable = booking?.statut === 'CONFIRMEE' || booking?.statut === 'EN_COURS';

    const openChat = () => {
        if (!booking?.artisan) return;
        const nomInterlocuteur = isArtisan
            ? `${booking.client?.prenom ?? ''} ${booking.client?.nom ?? ''}`.trim() || 'Client'
            : nomArtisan || 'Artisan';
        startConversation.mutate(
            { artisanId: booking.artisan.id, bookingId: booking.id },
            {
                onSuccess: (conv) =>
                    router.push({
                        pathname: '/conversation/[id]',
                        params: {
                            id: conv.id,
                            nom: nomInterlocuteur,
                        },
                    }),
            },
        );
    };

    const confirmerRendezVous = () => {
        Alert.alert(
            'Confirmer le rendez-vous',
            "L'artisan sera prévenu et pourra se déplacer. Le prix se discute directement avec lui, dans la messagerie ou sur place.",
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Confirmer',
                    onPress: () =>
                        confirm.mutate(undefined, {
                            onError: (e) =>
                                Alert.alert(
                                    'Erreur',
                                    e instanceof ApiError ? e.message : 'Réessayez.',
                                ),
                        }),
                },
            ],
        );
    };

    const cancelBooking = () => {
        Alert.alert('Annuler la réservation', 'Voulez-vous vraiment annuler cette demande ?', [
            { text: 'Non', style: 'cancel' },
            {
                text: 'Oui, annuler',
                style: 'destructive',
                onPress: () =>
                    cancel.mutate(undefined, {
                        onError: (e) =>
                            Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Réessayez.'),
                    }),
            },
        ]);
    };

    const nomArtisan =
        booking?.artisan?.nomEntreprise ??
        `${booking?.artisan?.user?.prenom ?? ''} ${booking?.artisan?.user?.nom ?? ''}`.trim();

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
                <Text style={styles.screenTitle}>Réservation</Text>
                <View style={{ width: 40 }} />
            </View>

            {isLoading || !booking ? (
                <View style={{ padding: spacing.xl, gap: spacing.lg }}>
                    <Skeleton height={110} borderRadius={radii.lg} />
                    <Skeleton height={70} borderRadius={radii.lg} />
                    <Skeleton height={160} borderRadius={radii.lg} />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Statut + timeline */}
                    <Card style={{ gap: spacing.md }}>
                        <View style={styles.statusRow}>
                            <Text style={styles.bookingTitle} numberOfLines={2}>
                                {booking.titre}
                            </Text>
                            {meta && <Badge label={meta.label} tone={meta.tone} />}
                        </View>
                        {description ? (
                            <Text style={styles.statusDescription}>{description}</Text>
                        ) : null}

                        {currentStep >= 0 && (
                            <View style={styles.timeline}>
                                {TIMELINE_STEPS.map((step, i) => (
                                    <React.Fragment key={step}>
                                        <View
                                            style={[
                                                styles.timelineDot,
                                                i <= currentStep && styles.timelineDotDone,
                                            ]}
                                        >
                                            {i <= currentStep && (
                                                <CheckCircle2
                                                    size={14}
                                                    color={colors.onPrimary}
                                                    strokeWidth={2.5}
                                                />
                                            )}
                                        </View>
                                        {i < TIMELINE_STEPS.length - 1 && (
                                            <View
                                                style={[
                                                    styles.timelineLine,
                                                    i < currentStep && styles.timelineLineDone,
                                                ]}
                                            />
                                        )}
                                    </React.Fragment>
                                ))}
                            </View>
                        )}
                    </Card>

                    {/* Suivi temps réel */}
                    {trackable && (
                        <Pressable
                            onPress={() =>
                                router.push({
                                    pathname: '/tracking/[bookingId]',
                                    params: { bookingId: booking.id },
                                })
                            }
                            style={({ pressed }) => [styles.trackCard, pressed && { opacity: 0.92 }]}
                            accessibilityRole="button"
                        >
                            <View style={styles.trackIcon}>
                                <Navigation size={20} color={colors.onDark} strokeWidth={2} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.trackTitle}>
                                    {isArtisan
                                        ? 'Mode « Je pars » : partager ma position'
                                        : "Suivre l'artisan en direct"}
                                </Text>
                                <Text style={styles.trackText}>
                                    {isArtisan
                                        ? 'Le client vous voit arriver sur la carte en temps réel'
                                        : "Position en temps réel et heure d'arrivée estimée"}
                                </Text>
                            </View>
                        </Pressable>
                    )}

                    {/* Interlocuteur : l'artisan voit le CLIENT, le client voit l'ARTISAN */}
                    {isArtisan && booking.client ? (
                        <Card style={styles.artisanCard}>
                            <Avatar
                                name={`${booking.client.prenom ?? ''} ${booking.client.nom ?? ''}`.trim() || 'Client'}
                                uri={booking.client.photoUrl}
                                size={48}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.artisanName}>
                                    {`${booking.client.prenom ?? ''} ${booking.client.nom ?? ''}`.trim() ||
                                        'Client'}
                                </Text>
                                <Text style={styles.artisanMeta}>
                                    Client · {booking.metier?.nom ?? ''}
                                </Text>
                            </View>
                            <Pressable
                                onPress={openChat}
                                style={styles.chatButton}
                                accessibilityRole="button"
                                accessibilityLabel="Discuter avec le client"
                            >
                                <MessageCircle size={20} color={colors.primary} strokeWidth={2} />
                            </Pressable>
                        </Card>
                    ) : !isArtisan && booking.artisan ? (
                        <Card style={styles.artisanCard}>
                            <Avatar
                                name={nomArtisan}
                                uri={
                                    booking.artisan.photoProfilUrl ??
                                    booking.artisan.user?.photoUrl
                                }
                                size={48}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.artisanName}>{nomArtisan}</Text>
                                <Text style={styles.artisanMeta}>
                                    ⭐ {Number(booking.artisan.noteMoyenne).toFixed(1)} ·{' '}
                                    {booking.metier?.nom ?? ''}
                                </Text>
                            </View>
                            <Pressable
                                onPress={openChat}
                                style={styles.chatButton}
                                accessibilityRole="button"
                                accessibilityLabel="Discuter avec l'artisan"
                            >
                                <MessageCircle size={20} color={colors.primary} strokeWidth={2} />
                            </Pressable>
                        </Card>
                    ) : null}

                    {/* Détails */}
                    <Card style={{ gap: spacing.md }}>
                        <DetailRow
                            icon={<MapPin size={16} color={colors.textSecondary} strokeWidth={2} />}
                            text={booking.adresseIntervention}
                        />
                        {booking.datePreferee && (
                            <DetailRow
                                icon={
                                    <CalendarDays
                                        size={16}
                                        color={colors.textSecondary}
                                        strokeWidth={2}
                                    />
                                }
                                text={new Date(booking.datePreferee).toLocaleString('fr-FR', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            />
                        )}
                        <Text style={styles.description}>{booking.description}</Text>
                    </Card>

                    {/* PIVOT PROXIMITÉ : le prix se discute entre client et
                        artisan, jamais fixé par la plateforme */}
                    <Card style={styles.negoCard}>
                        <View style={styles.negoIcon}>
                            <Handshake size={18} color={colors.accent} strokeWidth={2} />
                        </View>
                        <Text style={styles.negoText}>
                            Le prix se discute directement {isArtisan ? 'avec le client' : "avec l'artisan"},
                            dans la messagerie, au téléphone ou sur place. AlloArtisan ne fixe
                            aucun tarif.
                        </Text>
                    </Card>

                    {/* Noter l'artisan — intervention terminée, pas encore notée (client) */}
                    {!isArtisan && booking.statut === 'TERMINEE' && !booking.avis && (
                        <Button
                            title="⭐ Noter l'artisan"
                            variant="accent"
                            size="lg"
                            fullWidth
                            onPress={() =>
                                router.push({
                                    pathname: '/noter/[bookingId]',
                                    params: { bookingId: booking.id, nom: nomArtisan },
                                })
                            }
                        />
                    )}

                    {/* Panneau d'actions ARTISAN */}
                    {isArtisan && <ArtisanActionPanel booking={booking} />}

                    {/* Demande acceptée → le client confirme le rendez-vous */}
                    {!isArtisan &&
                        ['ACCEPTEE', 'PRIX_PROPOSE'].includes(booking.statut) && (
                            <Button
                                title="Confirmer le rendez-vous"
                                size="lg"
                                fullWidth
                                loading={confirm.isPending}
                                onPress={confirmerRendezVous}
                            />
                        )}

                    {/* Annulation */}
                    {!isArtisan &&
                    ['SOUMISE', 'ACCEPTEE', 'PRIX_PROPOSE', 'CONTRE_OFFRE'].includes(
                        booking.statut,
                    ) && (
                        <Button
                            title="Annuler la demande"
                            variant="ghost"
                            fullWidth
                            loading={cancel.isPending}
                            onPress={cancelBooking}
                        />
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

/**
 * Panneau d'actions de l'ARTISAN, selon le statut :
 * - SOUMISE : accepter la demande + envoyer un devis
 * - ACCEPTEE / CONTRE_OFFRE : envoyer/ajuster le devis
 * - CONFIRMEE : « Je pars » (suivi GPS) + démarrer l'intervention
 * - EN_COURS : terminer l'intervention
 */
function ArtisanActionPanel({ booking }: { booking: Booking }) {
    const router = useRouter();
    const { accept, start, complete } = useArtisanBookingActions(booking.id);

    const showError = (e: unknown) =>
        Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Réessayez.');

    const startIntervention = () => {
        Alert.alert("Démarrer l'intervention", 'Vous êtes sur place et commencez le travail ?', [
            { text: 'Pas encore', style: 'cancel' },
            {
                text: 'Oui, je commence',
                onPress: () => start.mutate(undefined, { onError: showError }),
            },
        ]);
    };

    const completeIntervention = () => {
        Alert.alert(
            "Terminer l'intervention",
            'Le travail est terminé ? Le client pourra alors vous noter.',
            [
                { text: 'Pas encore', style: 'cancel' },
                {
                    text: 'Oui, terminé',
                    onPress: () => complete.mutate(undefined, { onError: showError }),
                },
            ],
        );
    };

    return (
        <>
            {booking.statut === 'SOUMISE' && (
                <Button
                    title="Accepter le rendez-vous"
                    size="lg"
                    fullWidth
                    loading={accept.isPending}
                    onPress={() => accept.mutate(undefined, { onError: showError })}
                />
            )}

            {booking.statut === 'CONFIRMEE' && (
                <>
                    <Button
                        title="🛵 Je pars (suivi en direct)"
                        size="lg"
                        fullWidth
                        onPress={() =>
                            router.push({
                                pathname: '/tracking/[bookingId]',
                                params: { bookingId: booking.id },
                            })
                        }
                    />
                    <Button
                        title="Démarrer l'intervention"
                        variant="secondary"
                        fullWidth
                        loading={start.isPending}
                        onPress={startIntervention}
                    />
                </>
            )}

            {booking.statut === 'EN_COURS' && (
                <Button
                    title="✅ Terminer l'intervention"
                    variant="accent"
                    size="lg"
                    fullWidth
                    loading={complete.isPending}
                    onPress={completeIntervention}
                />
            )}
        </>
    );
}

function DetailRow({ icon, text }: { icon: React.ReactNode; text: string }) {
    return (
        <View style={styles.detailRow}>
            {icon}
            <Text style={styles.detailText}>{text}</Text>
        </View>
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
    screenTitle: {
        fontFamily: typography.heading,
        fontSize: fontSizes.lg,
        color: colors.text,
    },
    content: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing['4xl'],
        gap: spacing.lg,
    },
    negoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.accentSoft,
        borderWidth: 0,
    },
    negoIcon: {
        width: 38,
        height: 38,
        borderRadius: radii.full,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    negoText: {
        flex: 1,
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 4,
        color: colors.text,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: spacing.md,
    },
    bookingTitle: {
        fontFamily: typography.heading,
        fontSize: fontSizes.lg,
        color: colors.text,
        flex: 1,
    },
    statusDescription: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        lineHeight: lineHeights.sm + 2,
        color: colors.textSecondary,
    },
    timeline: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    timelineDot: {
        width: 22,
        height: 22,
        borderRadius: radii.full,
        backgroundColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    timelineDotDone: { backgroundColor: colors.primary },
    timelineLine: {
        flex: 1,
        height: 3,
        backgroundColor: colors.border,
    },
    timelineLineDone: { backgroundColor: colors.primary },
    trackCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.primary,
        borderRadius: radii.lg,
        padding: spacing.lg,
    },
    trackIcon: {
        width: 40,
        height: 40,
        borderRadius: radii.full,
        backgroundColor: 'rgba(255,255,255,0.16)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    trackTitle: {
        fontFamily: typography.heading,
        fontSize: fontSizes.md,
        color: colors.onDark,
    },
    trackText: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: 'rgba(255,255,255,0.85)',
        marginTop: 2,
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
    chatButton: {
        width: 44,
        height: 44,
        borderRadius: radii.full,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
    },
    detailText: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.text,
        flex: 1,
    },
    description: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        lineHeight: lineHeights.sm + 4,
        color: colors.textSecondary,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    priceLabel: {
        fontFamily: typography.body,
        fontSize: fontSizes.base,
        color: colors.textSecondary,
    },
    priceValue: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.base,
        color: colors.text,
    },
    priceValueStrong: {
        fontFamily: typography.heading,
        fontSize: fontSizes.lg,
        color: colors.primary,
    },
    priceWaiting: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.textMuted,
        fontStyle: 'italic',
    },
    payTitle: {
        fontFamily: typography.heading,
        fontSize: fontSizes.md,
        color: colors.text,
    },
    providerRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    providerChip: {
        flex: 1,
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.md,
        borderRadius: radii.md,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    providerChipSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    providerLabel: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    payField: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.background,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.lg,
        height: 48,
    },
    payInput: {
        flex: 1,
        fontFamily: typography.body,
        fontSize: fontSizes.base,
        color: colors.text,
    },
});
