import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

/**
 * Demande Express (mise en relation instantanée / dispatch).
 * Le client diffuse une demande aux artisans proches disponibles ; le premier
 * qui accepte décroche. Voir le module backend demandes-express.
 */

export type StatutDemandeExpress = 'EN_RECHERCHE' | 'ATTRIBUEE' | 'EXPIREE' | 'ANNULEE';

export interface DemandeExpressCreation {
    metierId: string;
    titre: string;
    description: string;
    adresseIntervention: string;
    latitude: number;
    longitude: number;
    estUrgent?: boolean;
    rayonKm?: number;
}

export interface DemandeExpressResume {
    id: string;
    statut: StatutDemandeExpress;
    bookingId?: string | null;
    nbArtisansNotifies: number;
    expireAt: string;
    createdAt?: string;
    // Renvoyés par GET /:id pour permettre de relancer (zone élargie) sans re-saisir
    metierId?: string;
    titre?: string;
    description?: string;
    adresseIntervention?: string;
    latitude?: number;
    longitude?: number;
    rayonKm?: number;
    estUrgent?: boolean;
}

export interface OpportuniteExpress {
    demandeId: string;
    titre: string;
    description: string;
    metier: string | null;
    adresseIntervention: string;
    estUrgent: boolean;
    distanceKm: number | null;
    expireAt: string;
    createdAt: string;
}

/** Client : diffuser une demande express. */
export function useCreateDemandeExpress() {
    return useMutation({
        mutationFn: async (input: DemandeExpressCreation) => {
            const { data } = await api.post<DemandeExpressResume>('/demandes-express', input);
            return data;
        },
    });
}

/** Client : suivre l'état (poll toutes les 3 s tant qu'on cherche). */
export function useDemandeExpress(id: string | null) {
    return useQuery({
        queryKey: ['demande-express', id],
        queryFn: async () => {
            const { data } = await api.get<DemandeExpressResume>(`/demandes-express/${id}`);
            return data;
        },
        enabled: !!id,
        refetchInterval: (query) =>
            query.state.data?.statut === 'EN_RECHERCHE' ? 3000 : false,
    });
}

/** Artisan : mes opportunités express en cours. */
export function useMesOpportunites(enabled = true) {
    return useQuery({
        queryKey: ['express', 'opportunites'],
        queryFn: async () => {
            const { data } = await api.get<OpportuniteExpress[]>(
                '/demandes-express/mes-opportunites',
            );
            return data;
        },
        enabled,
        refetchInterval: 15000,
    });
}

/** Artisan : accepter (le premier gagne). */
export function useAccepterDemandeExpress() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (demandeId: string) => {
            const { data } = await api.post<{ bookingId: string; demandeId: string }>(
                `/demandes-express/${demandeId}/accepter`,
            );
            return data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ['express', 'opportunites'] });
            void qc.invalidateQueries({ queryKey: ['bookings'] });
        },
    });
}

/** Client : annuler une demande en recherche. */
export function useAnnulerDemandeExpress() {
    return useMutation({
        mutationFn: async (demandeId: string) => {
            await api.post(`/demandes-express/${demandeId}/annuler`);
        },
    });
}
