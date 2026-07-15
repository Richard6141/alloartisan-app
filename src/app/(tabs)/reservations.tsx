import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { CalendarX2, CalendarDays, MapPin, Zap } from 'lucide-react-native';
import { useBookings } from '../../features/bookings/hooks';
import { useAuth } from '../../stores/auth';
import { LoginInvite } from '../../components/LoginInvite';
import { Card, Badge, Skeleton, EmptyState, Avatar, Button } from '../../components/ui';
import type { Booking, StatutBooking } from '../../types/api';
import { colors, palette, spacing, typography, fontSizes, radii } from '../../theme/tokens';

const STATUS_LABELS: Record<StatutBooking, { label: string; tone: 'primary' | 'success' | 'danger' | 'warning' | 'neutral' | 'accent' }> = {
    SOUMISE: { label: 'En attente', tone: 'warning' },
    ACCEPTEE: { label: 'Acceptée', tone: 'primary' },
    PRIX_PROPOSE: { label: 'Devis reçu', tone: 'accent' },
    CONTRE_OFFRE: { label: 'Négociation', tone: 'accent' },
    CONFIRMEE: { label: 'Confirmée', tone: 'primary' },
    EN_COURS: { label: 'En cours', tone: 'success' },
    TERMINEE: { label: 'Terminée', tone: 'neutral' },
    ANNULEE: { label: 'Annulée', tone: 'danger' },
    LITIGE: { label: 'Litige', tone: 'danger' },
};

export default function ReservationsScreen() {
    const status = useAuth((s) => s.status);

    if (status !== 'authenticated') {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <LoginInvite
                    title="Vos réservations"
                    message="Connectez-vous pour créer des demandes d'intervention et suivre vos artisans en temps réel."
                />
            </SafeAreaView>
        );
    }

    return <BookingsList />;
}

function BookingsList() {
    const { data, isLoading, error } = useBookings();
    const isArtisan = useAuth((s) => s.user?.role === 'ARTISAN');

    // Artisan inscrit mais profil métier pas encore créé → onboarding
    if (isArtisan && error) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <Text style={styles.title}>Mes missions</Text>
                <EmptyState
                    icon={<CalendarX2 size={48} color={colors.textMuted} strokeWidth={1.5} />}
                    title="Créez votre profil artisan"
                    message="Métier, zone d'intervention, tarifs : 2 minutes suffisent pour commencer à recevoir des demandes."
                    action={
                        <CreateProfileButton />
                    }
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Text style={styles.title}>{isArtisan ? 'Mes missions' : 'Mes réservations'}</Text>
            {isLoading && !data ? (
                <View style={{ paddingHorizontal: spacing.xl }}>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton
                            key={i}
                            height={104}
                            borderRadius={radii.lg}
                            style={{ marginBottom: spacing.md }}
                        />
                    ))}
                </View>
            ) : !data || data.length === 0 ? (
                <EmptyState
                    icon={<CalendarX2 size={48} color={colors.textMuted} strokeWidth={1.5} />}
                    title="Aucune réservation"
                    message="Trouvez un artisan depuis l'accueil et créez votre première demande."
                />
            ) : (
                <FlashList
                    data={data}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{
                        paddingHorizontal: spacing.xl,
                        paddingTop: spacing.sm, // laisse dépasser le badge de statut
                        paddingBottom: spacing['3xl'],
                    }}
                    ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
                    renderItem={({ item }) => (
                        <BookingCard booking={item} isArtisan={isArtisan} />
                    )}
                />
            )}
        </SafeAreaView>
    );
}

function CreateProfileButton() {
    const router = useRouter();
    return (
        <Button
            title="Créer mon profil artisan"
            size="lg"
            onPress={() => router.push('/artisan-onboarding')}
        />
    );
}

function BookingCard({ booking, isArtisan }: { booking: Booking; isArtisan: boolean }) {
    const router = useRouter();
    const status = STATUS_LABELS[booking.statut] ?? STATUS_LABELS.SOUMISE;
    const interlocuteur = isArtisan
        ? `${booking.client?.prenom ?? ''} ${booking.client?.nom ?? ''}`.trim() || 'Client'
        : (booking.artisan?.nomEntreprise ??
          `${booking.artisan?.user?.prenom ?? ''} ${booking.artisan?.user?.nom ?? ''}`.trim());
    const date = booking.datePreferee
        ? new Date(booking.datePreferee).toLocaleDateString('fr-FR', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
          })
        : null;

    const photo = isArtisan
        ? booking.client?.photoUrl
        : (booking.artisan?.photoProfilUrl ?? booking.artisan?.user?.photoUrl);

    return (
        <Pressable
            onPress={() =>
                router.push({ pathname: '/booking/[id]', params: { id: booking.id } })
            }
            accessibilityRole="button"
            accessibilityLabel={`Voir la réservation ${booking.titre}`}
            style={({ pressed }) => [pressed && { transform: [{ scale: 0.99 }] }]}
        >
            <Card style={styles.card}>
                {/* Photo de l'interlocuteur + identité */}
                <Avatar name={interlocuteur} uri={photo} size={46} />

                <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                            {booking.titre}
                        </Text>
                        {booking.estUrgent && (
                            <View style={styles.urgentDot}>
                                <Zap size={9} color="#FFF" fill="#FFF" strokeWidth={0} />
                            </View>
                        )}
                    </View>

                    <Text style={styles.cardMeta} numberOfLines={1}>
                        {interlocuteur}
                        {booking.metier ? ` · ${booking.metier.nom}` : ''}
                    </Text>

                    <View style={styles.cardFooter}>
                        <View style={{ flex: 1, gap: 2 }}>
                            {date ? (
                                <View style={styles.metaRow}>
                                    <CalendarDays
                                        size={11}
                                        color={colors.textMuted}
                                        strokeWidth={2}
                                    />
                                    <Text style={styles.metaSmall} numberOfLines={1}>
                                        {date}
                                    </Text>
                                </View>
                            ) : null}
                            <View style={styles.metaRow}>
                                <MapPin size={11} color={colors.textMuted} strokeWidth={2} />
                                <Text style={styles.metaSmall} numberOfLines={1}>
                                    {booking.adresseIntervention}
                                </Text>
                            </View>
                        </View>
                        {/* PIVOT : plus de montants en liste, le prix se discute */}
                    </View>
                </View>

                {/* Statut en haut à droite */}
                <View style={styles.statusBadge}>
                    <Badge label={status.label} tone={status.tone} />
                </View>
            </Card>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    title: {
        fontFamily: typography.heading,
        fontSize: fontSizes.xl,
        color: colors.text,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.lg,
        paddingBottom: spacing.lg,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
        paddingTop: spacing.lg + 6, // place pour le badge de statut
    },
    statusBadge: {
        position: 'absolute',
        top: -8,
        right: 14,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    cardTitle: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.base,
        color: colors.text,
        flexShrink: 1,
    },
    urgentDot: {
        width: 16,
        height: 16,
        borderRadius: radii.full,
        backgroundColor: palette.red600,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardMeta: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        color: colors.primary,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaSmall: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs - 1,
        color: colors.textMuted,
        flexShrink: 1,
    },
    cardPrice: {
        fontFamily: typography.heading,
        fontSize: fontSizes.base,
        color: colors.primary,
        letterSpacing: -0.2,
    },
    priceTag: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs - 2,
        color: colors.textMuted,
    },
});
