import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import type { Booking, Paginated } from '../../types/api';

export function useBookings(enabled = true) {
    return useQuery({
        queryKey: queryKeys.bookings,
        queryFn: async () => {
            // Le back renvoie { data, meta }
            const { data } = await api.get<{ data: Booking[] }>('/bookings', {
                params: { limit: 50 },
            });
            return data.data;
        },
        enabled,
    });
}

export function useBooking(id: string) {
    return useQuery({
        queryKey: queryKeys.booking(id),
        queryFn: async () => {
            const { data } = await api.get<Booking>(`/bookings/${id}`);
            return data;
        },
        // Statuts qui bougent : rafraîchir régulièrement quand l'écran est ouvert
        refetchInterval: 20000,
    });
}

export interface CreateBookingPayload {
    artisanId: string;
    metierId: string;
    titre: string;
    description: string;
    adresseIntervention: string;
    latitudeIntervention?: number;
    longitudeIntervention?: number;
    datePreferee?: string;
    budgetClient?: number;
    estUrgent?: boolean;
    type?: 'STANDARD' | 'URGENCE' | 'DEVIS';
}

export function useCreateBooking() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: CreateBookingPayload) => {
            const { data } = await api.post<Booking>('/bookings', payload);
            return data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
        },
    });
}

/** Actions sur une réservation (client) */
export function useBookingAction(bookingId: string) {
    const queryClient = useQueryClient();
    const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.booking(bookingId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
    };

    const confirm = useMutation({
        mutationFn: async () => {
            const { data } = await api.patch<Booking>(`/bookings/${bookingId}/confirm`);
            return data;
        },
        onSuccess: invalidate,
    });

    const cancel = useMutation({
        mutationFn: async (raison?: string) => {
            const { data } = await api.patch<Booking>(`/bookings/${bookingId}/cancel`, {
                raison,
            });
            return data;
        },
        onSuccess: invalidate,
    });

    return { confirm, cancel };
}

/** Actions de l'ARTISAN sur une demande */
export function useArtisanBookingActions(bookingId: string) {
    const queryClient = useQueryClient();
    const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.booking(bookingId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
    };

    const accept = useMutation({
        mutationFn: async () => {
            const { data } = await api.patch<Booking>(`/bookings/${bookingId}/accept`);
            return data;
        },
        onSuccess: invalidate,
    });

    const proposePrice = useMutation({
        mutationFn: async (payload: { prixPropose: number; dureeEstimeeHeures?: number }) => {
            const { data } = await api.patch<Booking>(
                `/bookings/${bookingId}/propose-price`,
                payload,
            );
            return data;
        },
        onSuccess: invalidate,
    });

    const start = useMutation({
        mutationFn: async () => {
            const { data } = await api.patch<Booking>(`/bookings/${bookingId}/start`);
            return data;
        },
        onSuccess: invalidate,
    });

    const complete = useMutation({
        mutationFn: async () => {
            const { data } = await api.patch<Booking>(`/bookings/${bookingId}/complete`);
            return data;
        },
        onSuccess: invalidate,
    });

    return { accept, proposePrice, start, complete };
}

export interface PaymentInitResult {
    transactionId: string;
    paymentUrl?: string;
    montant: number;
    reduction: number;
    provider: string;
}

export function useInitiatePayment(bookingId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: {
            provider: 'fedapay' | 'kkiapay' | 'cash';
            phoneNumber?: string;
            codePromo?: string;
        }) => {
            const { data } = await api.post<PaymentInitResult>(
                `/payments/initiate/${bookingId}`,
                payload,
            );
            return data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.booking(bookingId) });
        },
    });
}
