import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../stores/auth';
import { useBookings } from '../bookings/hooks';

/**
 * Points rouges de la barre d'onglets :
 * - messages      : au moins un message non lu (compteur serveur, poll 30 s)
 * - reservations  : quelque chose attend une action —
 *   artisan : nouvelle demande SOUMISE · client : devis reçu (PRIX_PROPOSE)
 */
export function useTabBadges(): Record<string, boolean> {
    const status = useAuth((s) => s.status);
    const isArtisan = useAuth((s) => s.user?.role === 'ARTISAN');
    const authenticated = status === 'authenticated';

    const { data: unreadMessages } = useQuery({
        queryKey: ['messages', 'unread-count'],
        queryFn: async () => {
            const { data } = await api.get<number | { count: number }>(
                '/messages/unread-count',
            );
            return typeof data === 'number' ? data : data.count;
        },
        enabled: authenticated,
        refetchInterval: 30000,
        staleTime: 15000,
    });

    const { data: bookings } = useBookings(authenticated);
    const needsAttention = (bookings ?? []).some((b) =>
        isArtisan ? b.statut === 'SOUMISE' : b.statut === 'PRIX_PROPOSE',
    );

    return {
        messages: (unreadMessages ?? 0) > 0,
        reservations: needsAttention,
    };
}
