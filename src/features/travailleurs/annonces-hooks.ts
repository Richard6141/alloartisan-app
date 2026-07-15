import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import type { AnnonceChantier, CandidatInteret } from '../../types/api';

export interface CreateAnnonceInput {
    type: 'OUVRIER' | 'AIDE';
    metierId?: string;
    nombrePersonnes?: number;
    latitude: number;
    longitude: number;
    ville: string;
    periode: 'UNE_JOURNEE' | 'PLUSIEURS_JOURS' | 'REGULIER';
    tarifJournalier?: number;
    description: string;
}

/** Publier une annonce (patron) */
export function useCreerAnnonce() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input: CreateAnnonceInput) => {
            const { data } = await api.post<AnnonceChantier>('/annonces', input);
            return data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: queryKeys.mesAnnonces });
        },
    });
}

/** Mes annonces (patron) */
export function useMesAnnonces(enabled = true) {
    return useQuery({
        queryKey: queryKeys.mesAnnonces,
        queryFn: async () => {
            const { data } = await api.get<AnnonceChantier[]>('/annonces/mes');
            return data;
        },
        enabled,
        staleTime: 60 * 1000,
    });
}

/** Annonces de chantier autour de moi (travailleur) */
export function useAnnoncesAutour(
    position: { latitude: number; longitude: number } | null,
    rayonKm: number,
    type?: 'OUVRIER' | 'AIDE',
) {
    const params = {
        latitude: position?.latitude,
        longitude: position?.longitude,
        rayonKm,
        ...(type ? { type } : {}),
    };
    return useQuery({
        queryKey: queryKeys.annoncesAutour(params),
        queryFn: async () => {
            const { data } = await api.get<AnnonceChantier[]>('/annonces/autour', { params });
            return data;
        },
        enabled: position != null,
        staleTime: 2 * 60 * 1000,
    });
}

/** Se manifester sur une annonce (travailleur) */
export function useManifesterInteret() {
    return useMutation({
        mutationFn: async (input: { annonceId: string; message?: string }) => {
            const { data } = await api.post(`/annonces/${input.annonceId}/interet`, {
                message: input.message,
            });
            return data;
        },
    });
}

/** Candidats d'une annonce (patron) */
export function useCandidats(annonceId: string, enabled = true) {
    return useQuery({
        queryKey: queryKeys.candidatsAnnonce(annonceId),
        queryFn: async () => {
            const { data } = await api.get<CandidatInteret[]>(`/annonces/${annonceId}/candidats`);
            return data;
        },
        enabled,
        staleTime: 30 * 1000,
    });
}

/** Clôturer une annonce (patron) */
export function useCloturerAnnonce() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input: { annonceId: string; statut: 'POURVUE' | 'CLOSE' }) => {
            const { data } = await api.patch<AnnonceChantier>(
                `/annonces/${input.annonceId}/cloturer`,
                { statut: input.statut },
            );
            return data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: queryKeys.mesAnnonces });
        },
    });
}
