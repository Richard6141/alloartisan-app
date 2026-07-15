import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { useAuth } from '../../stores/auth';
import type { ArtisanSummary } from '../../types/api';

export interface FavoriEntry {
    favoriId: string;
    ajouteLe: string;
    artisan: ArtisanSummary;
}

/** Liste des favoris — partagée entre l'écran favoris et les cœurs des cartes */
export function useFavoris() {
    const status = useAuth((s) => s.status);
    return useQuery({
        queryKey: queryKeys.favoris,
        queryFn: async () => {
            const { data } = await api.get<{ data: FavoriEntry[] }>('/favoris');
            return data.data;
        },
        enabled: status === 'authenticated',
        staleTime: 60 * 1000,
    });
}

/** Ensemble des IDs d'artisans favoris (lecture rapide pour l'état des cœurs) */
export function useFavorisSet(): Set<string> {
    const { data } = useFavoris();
    return new Set((data ?? []).map((f) => f.artisan.id));
}

/**
 * Bascule favori avec mise à jour OPTIMISTE : le cœur réagit instantanément,
 * l'appel réseau suit, et on revient en arrière si le serveur refuse.
 */
export function useToggleFavori() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            artisan,
            isFavori,
        }: {
            artisan: ArtisanSummary;
            isFavori: boolean;
        }) => {
            if (isFavori) {
                await api.delete(`/favoris/${artisan.id}`);
            } else {
                await api.post(`/favoris/${artisan.id}`);
            }
        },
        onMutate: async ({ artisan, isFavori }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.favoris });
            const previous = queryClient.getQueryData<FavoriEntry[]>(queryKeys.favoris);

            queryClient.setQueryData<FavoriEntry[]>(queryKeys.favoris, (old = []) =>
                isFavori
                    ? old.filter((f) => f.artisan.id !== artisan.id)
                    : [
                          {
                              favoriId: `optimistic-${artisan.id}`,
                              ajouteLe: new Date().toISOString(),
                              artisan,
                          },
                          ...old,
                      ],
            );
            return { previous };
        },
        onError: (_err, _vars, context) => {
            // Le serveur a refusé → on restaure l'état précédent
            if (context?.previous) {
                queryClient.setQueryData(queryKeys.favoris, context.previous);
            }
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.favoris });
        },
    });
}
