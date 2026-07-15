import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { resolveCoords } from '../../lib/geo';
import type { ArtisanSummary, CategorieMetier, Paginated } from '../../types/api';

/**
 * Position approximative du client (~100 m), obtenue SILENCIEUSEMENT : seulement
 * si la permission est déjà accordée, jamais de popup. Elle alimente les
 * distances affichées sur toutes les cartes artisan (plateforme proximité).
 */
export function usePositionApprox() {
    const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    useEffect(() => {
        let actif = true;
        void resolveCoords({ request: false }).then((c) => {
            if (actif) setCoords(c);
        });
        return () => {
            actif = false;
        };
    }, []);
    return coords;
}

/** Catégories de métiers — cache long (24h) : consultable hors ligne */
export function useCategories() {
    return useQuery({
        queryKey: queryKeys.categories,
        queryFn: async () => {
            const { data } = await api.get<CategorieMetier[]>('/categories-metiers');
            return data;
        },
        staleTime: 24 * 60 * 60 * 1000,
    });
}

export interface SearchParams {
    q?: string;
    metierSlug?: string;
    categorieSlug?: string;
    urgence?: boolean;
    /** Position du client : chaque résultat porte alors sa distance réelle */
    latitude?: number;
    longitude?: number;
    page?: number;
    limit?: number;
}

/** Réponse brute du back-end (/artisans/search) */
interface SearchResponse {
    data: ArtisanSummary[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

/** Suggestion de recherche (métier, entreprise ou ville) */
export interface Suggestion {
    value: string;
    type: 'metier' | 'artisan' | 'ville';
}

/** Suggestions pendant la frappe — cache serveur Redis 1 h */
export function useAutocomplete(q: string) {
    return useQuery({
        queryKey: ['search', 'autocomplete', q],
        queryFn: async () => {
            const { data } = await api.get<Suggestion[]>('/search/autocomplete', {
                params: { q },
            });
            return data;
        },
        enabled: q.trim().length >= 2,
        staleTime: 60 * 60 * 1000,
    });
}

/** Réponse d'un artisan proche (PostGIS), déjà en camelCase côté serveur */
interface NearbyArtisan {
    id: string;
    nomEntreprise?: string | null;
    slogan?: string | null;
    photoProfilUrl?: string | null;
    noteMoyenne: number;
    nombreAvis: number;
    tarifHoraire?: number | null;
    abonnementType: 'GRATUIT' | 'STANDARD' | 'PREMIUM' | 'GOLD';
    villePrincipale: string;
    disponible: boolean;
    distanceKm?: number | null;
    /** Position légèrement floutée (~100 m), pour la vue carte */
    latitude?: number | null;
    longitude?: number | null;
    user?: { nom?: string | null; prenom?: string | null; photoUrl?: string | null };
}

/**
 * « Autour de moi » : artisans disponibles dans un rayon donné, triés par
 * abonnement puis distance. Ne renvoie QUE des artisans vérifiés dont la
 * zone d'intervention couvre la position du client.
 */
export function useNearbyArtisans(
    position: { latitude: number; longitude: number } | null,
    radiusKm: number,
) {
    return useQuery({
        queryKey: ['artisans', 'nearby', position?.latitude, position?.longitude, radiusKm],
        queryFn: async (): Promise<ArtisanSummary[]> => {
            const { data } = await api.get<NearbyArtisan[]>('/geolocation/artisans/nearby', {
                params: {
                    lat: position!.latitude,
                    lng: position!.longitude,
                    radius: radiusKm,
                    limit: 30,
                },
            });
            // Complète les champs attendus par les cartes artisan
            return data.map((a) => ({
                ...a,
                verified: true, // la route ne renvoie que des artisans vérifiés
                accepteUrgences: false,
                distanceKm: a.distanceKm ?? undefined,
            }));
        },
        enabled: position != null,
        staleTime: 2 * 60 * 1000,
    });
}

/** Recherche d'artisans — mise en cache par combinaison de filtres */
export function useArtisanSearch(params: SearchParams, enabled = true) {
    return useQuery({
        queryKey: queryKeys.artisanSearch(params as Record<string, unknown>),
        queryFn: async (): Promise<Paginated<ArtisanSummary>> => {
            // Le DTO du back est en whitelist stricte : n'envoyer que ses champs
            const { data } = await api.get<SearchResponse>('/artisans/search', {
                params: {
                    q: params.q,
                    metierSlug: params.metierSlug,
                    categorieSlug: params.categorieSlug,
                    accepteUrgences: params.urgence ? true : undefined,
                    latitude: params.latitude,
                    longitude: params.longitude,
                    page: params.page,
                    limit: params.limit,
                },
            });
            return { items: data.data, total: data.total, page: data.page, limit: data.limit };
        },
        enabled,
        staleTime: 5 * 60 * 1000,
    });
}
