import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import type { ArtisanDetail, Certification, Portfolio } from '../../types/api';

/**
 * Espace pro de l'artisan connecté : profil, justificatifs, réalisations.
 * La clé ['artisan', 'me'] est partagée avec l'écran Activité.
 */

export function useMyArtisanProfile(enabled = true) {
    return useQuery({
        queryKey: ['artisan', 'me'],
        queryFn: async () => {
            const { data } = await api.get<ArtisanDetail>('/artisans/me');
            return data;
        },
        enabled,
        // 404 = compte ARTISAN sans profil créé : état légitime, ne pas réessayer
        retry: (count, error) =>
            !(error instanceof ApiError && error.status === 404) && count < 2,
        // Tant que le dossier attend une décision (ou une resoumission traitée
        // en arrière-plan), le statut se rafraîchit seul : « Profil refusé »
        // redevient « en attente » sans action de l'artisan
        refetchInterval: (query) => {
            const statut = query.state.data?.statut;
            return statut === 'EN_ATTENTE' || statut === 'REJETE' ? 15000 : false;
        },
    });
}

export function useUpdateArtisanProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: Record<string, unknown>) => {
            const { data } = await api.patch<ArtisanDetail>('/artisans/me', payload);
            return data;
        },
        onSuccess: (data) => {
            queryClient.setQueryData(['artisan', 'me'], data);
            void queryClient.invalidateQueries({ queryKey: ['artisans'] });
        },
    });
}

export interface MetierInput {
    metierId: string;
    estPrincipal?: boolean;
    tarifHoraire?: number;
    anneesExperience?: number;
}

export function useUpdateArtisanMetiers() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (metiers: MetierInput[]) => {
            const { data } = await api.patch<ArtisanDetail>('/artisans/me/metiers', { metiers });
            return data;
        },
        onSuccess: (data) => {
            queryClient.setQueryData(['artisan', 'me'], data);
            void queryClient.invalidateQueries({ queryKey: ['artisans'] });
        },
    });
}

// ─── Abonnement (la source de revenus : quotas de mises en relation) ─────────

export type PlanType = 'GRATUIT' | 'STANDARD' | 'PREMIUM' | 'GOLD';
export type PlanPayant = 'STANDARD' | 'PREMIUM' | 'GOLD';

export interface SubscriptionPlan {
    type: PlanType;
    prix: number;
    devise: string;
    /** null = illimité */
    demandesMois: number | null;
    avantages: string[];
    badge: string | null;
}

export interface MySubscription {
    plan: PlanType;
    expireAt: string | null;
    estActif: boolean;
    demandesUtilisees: number;
    /** null = illimité */
    demandesRestantes: number | null;
    /** null = illimité */
    quotaMensuel: number | null;
    /** Essais découverte gratuits (à vie) encore disponibles */
    essaisRestants: number;
    /** Total d'essais découverte offerts */
    essaisGratuits: number;
    expireBientot: boolean;
}

export function useSubscriptionPlans() {
    return useQuery({
        queryKey: ['subscriptions', 'plans'],
        queryFn: async () => {
            const { data } = await api.get<SubscriptionPlan[]>('/subscriptions/plans');
            return data;
        },
        staleTime: 24 * 60 * 60 * 1000,
    });
}

export function useMySubscription(enabled = true) {
    return useQuery({
        queryKey: ['subscriptions', 'my'],
        queryFn: async () => {
            const { data } = await api.get<MySubscription>('/subscriptions/my');
            return data;
        },
        enabled,
    });
}

export interface IntentionPaiement {
    paiementId: string;
    plan: PlanPayant;
    montant: number;
    provider: 'fedapay';
    /** Page de checkout FedaPay à ouvrir dans l'app */
    paymentUrl: string;
}

/** Prépare le paiement d'un palier : intention + URL de checkout FedaPay */
export function usePayerAbonnement() {
    return useMutation({
        mutationFn: async (input: { plan: PlanPayant }) => {
            const { data } = await api.post<IntentionPaiement>('/subscriptions/pay', input);
            return data;
        },
    });
}

/** Après le checkout : le serveur vérifie la transaction et active le palier */
export function useVerifierPaiementAbonnement() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (paiementId: string) => {
            const { data } = await api.post<{
                statut: 'COMPLETEE' | 'EN_ATTENTE' | 'ECHOUEE';
                plan: string;
            }>(`/subscriptions/pay/${paiementId}/verifier`);
            return data;
        },
        onSuccess: (data) => {
            if (data.statut === 'COMPLETEE') {
                void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
                void queryClient.invalidateQueries({ queryKey: ['artisan'] });
            }
        },
    });
}

// ─── Justificatifs (certifications) ──────────────────────────────────────────

export function useMyCertifications(enabled = true) {
    return useQuery({
        queryKey: ['certifications', 'me'],
        queryFn: async () => {
            const { data } = await api.get<{ data: Certification[]; total: number }>(
                '/certifications/me',
            );
            return data.data;
        },
        enabled,
        // Le document est traité en arrière-plan côté serveur : tant qu'une
        // pièce n'a pas d'URL, on re-vérifie toutes les 5 s pour l'afficher
        refetchInterval: (query) =>
            query.state.data?.some((c) => !c.documentUrl) ? 5000 : false,
    });
}

/** Fichier local (photo ou PDF) prêt pour un envoi multipart */
export interface LocalDocument {
    uri: string;
    name: string;
    mimeType: string;
}

export function useAddCertification() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: {
            titre: string;
            organisme?: string;
            dateObtention?: string;
            type?: 'IDENTITE' | 'METIER';
            metierId?: string;
            document?: LocalDocument | null;
        }) => {
            const form = new FormData();
            form.append('titre', input.titre);
            if (input.organisme) form.append('organisme', input.organisme);
            if (input.dateObtention) form.append('dateObtention', input.dateObtention);
            if (input.type) form.append('type', input.type);
            if (input.metierId) form.append('metierId', input.metierId);
            if (input.document) {
                form.append('document', {
                    uri: input.document.uri,
                    name: input.document.name,
                    type: input.document.mimeType,
                } as unknown as Blob);
            }
            const { data } = await api.post<Certification>('/certifications/me', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 90000,
            });
            return data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['certifications', 'me'] });
            // La resoumission peut faire repasser un profil REJETE en attente
            void queryClient.invalidateQueries({ queryKey: ['artisan', 'me'] });
        },
    });
}

export function useReplaceCertificationDocument() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { certificationId: string; document: LocalDocument }) => {
            const form = new FormData();
            form.append('document', {
                uri: input.document.uri,
                name: input.document.name,
                type: input.document.mimeType,
            } as unknown as Blob);
            await api.post(`/certifications/me/${input.certificationId}/document`, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 90000,
            });
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['certifications', 'me'] });
            // La resoumission peut faire repasser un profil REJETE en attente
            void queryClient.invalidateQueries({ queryKey: ['artisan', 'me'] });
        },
    });
}

export function useDeleteCertification() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (certificationId: string) => {
            await api.delete(`/certifications/me/${certificationId}`);
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['certifications', 'me'] });
        },
    });
}

// ─── Portfolio (réalisations) ─────────────────────────────────────────────────

export function usePortfolio(artisanId: string | undefined) {
    return useQuery({
        queryKey: ['portfolio', artisanId],
        queryFn: async () => {
            const { data } = await api.get<Portfolio>(`/artisans/${artisanId}/portfolio`);
            return data;
        },
        enabled: !!artisanId,
    });
}

export function useAddPortfolioPhoto(artisanId: string | undefined) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { photo: LocalDocument; caption?: string }) => {
            const form = new FormData();
            form.append('file', {
                uri: input.photo.uri,
                name: input.photo.name,
                type: input.photo.mimeType,
            } as unknown as Blob);
            if (input.caption?.trim()) form.append('caption', input.caption.trim());
            const { data } = await api.post<Portfolio>(
                `/artisans/${artisanId}/portfolio/photos`,
                form,
                { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 90000 },
            );
            return data;
        },
        onSuccess: (data) => {
            queryClient.setQueryData(['portfolio', artisanId], data);
            if (artisanId) {
                void queryClient.invalidateQueries({ queryKey: ['artisans', artisanId] });
            }
        },
    });
}

export function useDeletePortfolioItem(artisanId: string | undefined) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (url: string) => {
            const { data } = await api.delete<Portfolio>(`/artisans/${artisanId}/portfolio/items`, {
                data: { url },
            });
            return data;
        },
        onSuccess: (data) => {
            queryClient.setQueryData(['portfolio', artisanId], data);
            if (artisanId) {
                void queryClient.invalidateQueries({ queryKey: ['artisans', artisanId] });
            }
        },
    });
}
