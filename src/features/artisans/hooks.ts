import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import type { ArtisanDetail, Conversation, PaywallGate } from '../../types/api';

export interface Avis {
    id: string;
    note: number;
    commentaire?: string | null;
    reponseArtisan?: string | null;
    createdAt: string;
    client?: { prenom?: string | null; nom?: string | null; photoUrl?: string | null };
}

/** Fiche artisan — consultable hors ligne une fois visitée */
export function useArtisan(id: string) {
    return useQuery({
        queryKey: queryKeys.artisan(id),
        queryFn: async () => {
            const { data } = await api.get<ArtisanDetail>(`/artisans/${id}`);
            return data;
        },
        staleTime: 5 * 60 * 1000,
    });
}

export function useArtisanAvis(artisanId: string, limit = 10) {
    return useQuery({
        queryKey: [...queryKeys.artisan(artisanId), 'avis', limit],
        queryFn: async () => {
            const { data } = await api.get<{ data: Avis[] } | Avis[]>(
                `/avis/artisan/${artisanId}`,
                { params: { limit } },
            );
            return Array.isArray(data) ? data : data.data;
        },
        staleTime: 5 * 60 * 1000,
    });
}

export type RaisonSignalement = 'CONTENU_INAPPROPRIE' | 'FAUX_AVIS' | 'HARCELEMENT' | 'AUTRE';

/** Réponse de l'artisan à un avis reçu */
export function useRespondAvis(artisanId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ avisId, reponse }: { avisId: string; reponse: string }) => {
            await api.patch(`/avis/${avisId}/response`, { reponse });
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.artisan(artisanId) });
        },
    });
}

/** Signaler un avis abusif (tout utilisateur connecté) */
export function useReportAvis() {
    return useMutation({
        mutationFn: async (input: {
            avisId: string;
            raison: RaisonSignalement;
            details?: string;
        }) => {
            await api.post(`/avis/${input.avisId}/report`, {
                raison: input.raison,
                details: input.details,
            });
        },
    });
}

/** Réponse du déblocage d'une conversation (paywall artisan) */
export interface UnlockResult {
    verrouille: boolean;
    source?: 'essai' | 'abonnement';
    dejaDebloque?: boolean;
    gate: PaywallGate;
}

/**
 * Débloque une conversation (artisan) : consomme un essai découverte gratuit
 * puis, une fois épuisés, le quota d'abonnement. En cas de 402, l'appelant
 * redirige vers l'écran d'abonnement (ApiError.code = ABONNEMENT_REQUIS/QUOTA_EPUISE).
 */
export function useUnlockConversation(conversationId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const { data } = await api.post<UnlockResult>(
                `/messages/conversations/${conversationId}/debloquer`,
            );
            return data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.messages(conversationId) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
            void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
        },
    });
}

/** Ouvre (ou récupère) une conversation avec un artisan, puis navigue vers le chat */
export function useStartConversation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: {
            artisanId: string;
            bookingId?: string;
            // Main-d'œuvre : TRAVAIL = chat gratuit (hors paywall)
            contexte?: 'CLIENT' | 'TRAVAIL';
        }) => {
            const { data } = await api.post<Conversation>('/messages/conversations', payload);
            return data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
        },
    });
}
