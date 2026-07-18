import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

/**
 * Espace administration : KPI de la plateforme et files de validation
 * (artisans en attente, justificatifs à examiner).
 */

export interface AdminOverview {
    utilisateurs: {
        total: number;
        artisans: number;
        artisansActifs: number;
        artisansEnAttente: number;
    };
    bookings: {
        total: number;
        ceMois: number;
        termines: number;
        enCours: number;
        tauxCompletion: number;
    };
    revenus: { total: number; ceMois: number; commissionsTotal: number };
    avis: { total: number; noteMoyennePlateforme: string };
}

export interface AdminCertification {
    id: string;
    titre: string;
    organisme?: string | null;
    dateObtention?: string | null;
    numeroCertification?: string | null;
    documentUrl?: string | null;
    verifie: boolean;
    type: 'IDENTITE' | 'METIER';
    metierId?: string | null;
    statutVerification: 'EN_ATTENTE' | 'VALIDEE' | 'REJETEE';
    raisonRejet?: string | null;
    /** Présent sur /certifications/admin/pending */
    artisan?: {
        id: string;
        nomEntreprise?: string | null;
        user?: { nom?: string | null; prenom?: string | null; email?: string };
    };
}

export interface PendingArtisan {
    id: string;
    nomEntreprise?: string | null;
    villePrincipale: string;
    bio?: string | null;
    anneesExperience: number;
    numeroIfu?: string | null;
    createdAt: string;
    user: {
        nom?: string | null;
        prenom?: string | null;
        email: string;
        telephone?: string | null;
        createdAt: string;
    };
    certifications: AdminCertification[];
    metiers: {
        id: string;
        metierId: string;
        estPrincipal: boolean;
        certifie: boolean;
        metier: { nom: string };
    }[];
}

export function useAdminOverview(enabled = true) {
    return useQuery({
        queryKey: ['admin', 'overview'],
        queryFn: async () => {
            const { data } = await api.get<AdminOverview>('/admin/stats/overview');
            return data;
        },
        enabled,
        refetchInterval: 60000,
    });
}

export function usePendingArtisans(enabled = true) {
    return useQuery({
        queryKey: ['admin', 'pending-artisans'],
        queryFn: async () => {
            const { data } = await api.get<PendingArtisan[]>('/admin/artisans/pending');
            return data;
        },
        enabled,
        // Les resoumissions d'artisans arrivent à tout moment : la file se
        // rafraîchit seule (documents async compris)
        refetchInterval: 20000,
    });
}

export function usePendingCertifications(enabled = true) {
    return useQuery({
        queryKey: ['admin', 'pending-certifications'],
        queryFn: async () => {
            const { data } = await api.get<{ data: AdminCertification[]; total: number }>(
                '/certifications/admin/pending',
            );
            return data.data;
        },
        enabled,
        refetchInterval: 20000,
    });
}

function useInvalidateAdmin() {
    const queryClient = useQueryClient();
    return () => {
        void queryClient.invalidateQueries({ queryKey: ['admin'] });
        // Les fiches et recherches publiques changent après une validation
        void queryClient.invalidateQueries({ queryKey: ['artisans'] });
    };
}

export function useVerifyArtisan() {
    const invalidate = useInvalidateAdmin();
    return useMutation({
        mutationFn: async (artisanId: string) => {
            await api.patch(`/artisans/${artisanId}/verify`);
        },
        onSuccess: invalidate,
    });
}

export function useRejectArtisan() {
    const invalidate = useInvalidateAdmin();
    return useMutation({
        mutationFn: async (input: { artisanId: string; raison: string }) => {
            await api.patch(`/artisans/${input.artisanId}/reject`, { raison: input.raison });
        },
        onSuccess: invalidate,
    });
}

/** Déverrouille un document validé : l'artisan peut de nouveau le modifier */
export function useUnlockCertification() {
    const invalidate = useInvalidateAdmin();
    return useMutation({
        mutationFn: async (certificationId: string) => {
            await api.patch(`/certifications/admin/${certificationId}/unlock`);
        },
        onSuccess: invalidate,
    });
}

export interface AdminUserResult {
    id: string;
    nom?: string | null;
    prenom?: string | null;
    email: string;
    telephone?: string | null;
    role: string;
    artisan?: {
        id: string;
        verified: boolean;
        statut: string;
        noteMoyenne: number;
        nombreAvis: number;
    } | null;
}

/** Recherche d'artisans par nom/email/téléphone (pour le déverrouillage) */
export function useAdminSearchArtisans(search: string) {
    return useQuery({
        queryKey: ['admin', 'search-artisans', search],
        queryFn: async () => {
            const { data } = await api.get<{ data: AdminUserResult[] }>('/admin/users', {
                params: { search, role: 'ARTISAN', limit: 10 },
            });
            return data.data.filter((u) => u.artisan);
        },
        enabled: search.trim().length >= 2,
        staleTime: 30000,
    });
}

/** Tous les documents d'un artisan (identité comprise), pour le déverrouillage */
export function useAdminArtisanDocuments(artisanId: string | null) {
    return useQuery({
        queryKey: ['admin', 'artisan-documents', artisanId],
        queryFn: async () => {
            const { data } = await api.get<{ data: AdminCertification[]; total: number }>(
                `/certifications/admin/artisan/${artisanId}`,
            );
            return data.data;
        },
        enabled: !!artisanId,
    });
}

export interface PendingMetier {
    id: string;
    nom: string;
    slug: string;
    categorieId: string;
    createdAt: string;
    categorie: { id: string; nom: string; slug: string };
    _count?: { artisanMetiers: number };
}

/** Métiers suggérés par des artisans, en attente de validation admin */
export function usePendingMetiers(enabled = true) {
    return useQuery({
        queryKey: ['admin', 'pending-metiers'],
        queryFn: async () => {
            const { data } = await api.get<PendingMetier[]>('/metiers/admin/pending');
            return data;
        },
        enabled,
        refetchInterval: 30000,
    });
}

/** Valide un métier suggéré : il devient visible des clients */
export function useValidateMetier() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (metierId: string) => {
            await api.patch(`/metiers/${metierId}/valider`);
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['admin', 'pending-metiers'] });
            // La liste publique des métiers change après validation
            void queryClient.invalidateQueries({ queryKey: ['metiers'] });
        },
    });
}

export function useVerifyCertification() {
    const invalidate = useInvalidateAdmin();
    return useMutation({
        mutationFn: async (input: {
            certificationId: string;
            verifie: boolean;
            raison?: string;
            // Validation d'une pièce d'IDENTITE : indexe l'identité (anti-doublon)
            numeroPiece?: string;
            dateNaissance?: string;
        }) => {
            await api.patch(`/certifications/admin/${input.certificationId}/verify`, {
                verifie: input.verifie,
                raison: input.raison,
                numeroPiece: input.numeroPiece,
                dateNaissance: input.dateNaissance,
            });
        },
        onSuccess: invalidate,
    });
}

/** Empreinte d'identité : une identité correspond-elle déjà à un autre compte ? */
export interface IdentiteMatch {
    artisanId: string | null;
    userId: string;
    nomApercu: string | null;
    numeroApercu: string | null;
    createdAt: string;
    motif: 'numero' | 'nom' | 'image_exacte' | 'image_similaire';
}

export function useCheckIdentite() {
    return useMutation({
        mutationFn: async (input: {
            numeroPiece?: string;
            nom?: string;
            dateNaissance?: string;
            excludeArtisanId?: string;
        }) => {
            const { data } = await api.post<{ matches: IdentiteMatch[] }>(
                '/admin/fraud/identite/check',
                input,
            );
            return data.matches;
        },
    });
}

/**
 * Détection AUTOMATIQUE (sans saisie) : l'image de cette pièce d'identité
 * correspond-elle à un document déjà soumis par un autre compte ?
 */
export function useCertificationDocMatches(certificationId: string, enabled: boolean) {
    return useQuery({
        queryKey: ['admin', 'fraud', 'doc-matches', certificationId],
        queryFn: async () => {
            const { data } = await api.get<{ matches: IdentiteMatch[] }>(
                `/admin/fraud/identite/doc-matches/${certificationId}`,
            );
            return data.matches;
        },
        enabled,
        staleTime: 60000,
    });
}
