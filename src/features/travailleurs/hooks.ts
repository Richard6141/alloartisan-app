import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import type { ProfilTravailleur, EngagementTravail, Conversation } from '../../types/api';

export interface UpsertProfilTravailleurInput {
    type: 'OUVRIER' | 'AIDE';
    polyvalent?: boolean;
    description?: string;
    anneesExperience?: number;
    latitude: number;
    longitude: number;
    villePrincipale: string;
    zoneInterventionKm?: number;
    disponibilite: 'PONCTUEL' | 'REGULIER';
    disponibleMaintenant?: boolean;
    tarifJournalier?: number;
    actif?: boolean;
    metiers?: { metierId: string; estPrincipal?: boolean }[];
}

export interface SearchTravailleurFilters {
    type?: 'OUVRIER' | 'AIDE';
    metierId?: string;
    disponibleMaintenant?: boolean;
}

/** Mon profil travailleur (null si pas encore activé) */
export function useMonProfilTravailleur(enabled = true) {
    return useQuery({
        queryKey: queryKeys.monProfilTravailleur,
        queryFn: async () => {
            try {
                const { data } = await api.get<ProfilTravailleur>('/travailleurs/me');
                return data;
            } catch {
                return null; // 404 = pas de profil
            }
        },
        enabled,
        staleTime: 60 * 1000,
    });
}

/** Activer / mettre à jour mon profil travailleur */
export function useUpsertProfilTravailleur() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input: UpsertProfilTravailleurInput) => {
            const { data } = await api.post<ProfilTravailleur>('/travailleurs', input);
            return data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: queryKeys.monProfilTravailleur });
        },
    });
}

/** Recherche géolocalisée de travailleurs autour de la position */
export function useSearchTravailleurs(
    position: { latitude: number; longitude: number } | null,
    rayonKm: number,
    filters: SearchTravailleurFilters,
) {
    const params = {
        ...filters,
        latitude: position?.latitude,
        longitude: position?.longitude,
        rayonKm,
    };
    return useQuery({
        queryKey: queryKeys.travailleurSearch(params),
        queryFn: async () => {
            const { data } = await api.get<ProfilTravailleur[]>('/travailleurs/search', {
                params,
            });
            return data;
        },
        enabled: position != null,
        staleTime: 2 * 60 * 1000,
    });
}

/** Fiche d'un travailleur */
export function useTravailleurFiche(id: string) {
    return useQuery({
        queryKey: queryKeys.travailleur(id),
        queryFn: async () => {
            const { data } = await api.get<ProfilTravailleur>(`/travailleurs/${id}`);
            return data;
        },
        staleTime: 5 * 60 * 1000,
    });
}

/** Démarrer un chat gratuit avec un travailleur (contexte TRAVAIL) */
export function useStartTravailChat() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (travailleurUserId: string) => {
            const { data } = await api.post<Conversation>('/messages/conversations', {
                contexte: 'TRAVAIL',
                travailleurUserId,
            });
            return data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: queryKeys.conversations });
        },
    });
}

/** Embaucher un travailleur (crée un engagement) */
export function useEmbaucher() {
    return useMutation({
        mutationFn: async (input: { profilTravailleurId: string; conversationId?: string }) => {
            const { data } = await api.post<EngagementTravail>(
                '/travailleurs/engagements',
                input,
            );
            return data;
        },
    });
}

/** Terminer une mission */
export function useTerminerMission() {
    return useMutation({
        mutationFn: async (engagementId: string) => {
            const { data } = await api.patch<EngagementTravail>(
                `/travailleurs/engagements/${engagementId}/terminer`,
            );
            return data;
        },
    });
}

/** Déposer un avis (mutuel) sur une mission terminée */
export function useDeposerAvisTravail() {
    return useMutation({
        mutationFn: async (input: {
            engagementId: string;
            note: number;
            commentaire?: string;
        }) => {
            const { data } = await api.post(
                `/travailleurs/engagements/${input.engagementId}/avis`,
                { note: input.note, commentaire: input.commentaire },
            );
            return data;
        },
    });
}
