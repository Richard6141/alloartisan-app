import { QueryClient, onlineManager, focusManager } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AppState, AppStateStatus, Platform } from 'react-native';

/**
 * Cœur de l'expérience OFFLINE-FIRST.
 *
 * - Toutes les lectures (catégories, artisans, réservations, messages) sont
 *   persistées sur le disque : l'app affiche INSTANTANÉMENT le dernier état
 *   connu au lancement, même sans réseau, puis se resynchronise en arrière-plan.
 * - onlineManager branché sur NetInfo : les requêtes se mettent en pause
 *   hors ligne et repartent seules au retour du réseau.
 * - focusManager : refetch des données périmées quand l'app revient
 *   au premier plan.
 */

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000, // 1 min : données fraîches sans sur-requêter
            gcTime: 7 * 24 * 60 * 60 * 1000, // 7 jours en cache disque
            retry: 2,
            refetchOnReconnect: true,
        },
        mutations: {
            retry: 0, // Jamais de retry auto sur les écritures (paiement, booking)
        },
    },
});

export const asyncStoragePersister = createAsyncStoragePersister({
    storage: AsyncStorage,
    key: 'aa_query_cache',
    throttleTime: 2000,
});

/** À appeler une fois au démarrage de l'app */
export function setupOnlineManagement(): () => void {
    // Réseau → pause/reprise automatique des requêtes
    const unsubscribeNet = NetInfo.addEventListener((state) => {
        onlineManager.setOnline(!!state.isConnected && state.isInternetReachable !== false);
    });

    // Retour au premier plan → resynchronisation
    const onAppStateChange = (status: AppStateStatus) => {
        if (Platform.OS !== 'web') {
            focusManager.setFocused(status === 'active');
        }
    };
    const subscription = AppState.addEventListener('change', onAppStateChange);

    return () => {
        unsubscribeNet();
        subscription.remove();
    };
}

/** Clés de requête centralisées — évite les typos et les collisions */
export const queryKeys = {
    me: ['me'] as const,
    categories: ['categories'] as const,
    metiers: ['metiers'] as const,
    artisanSearch: (params: Record<string, unknown>) => ['artisans', 'search', params] as const,
    artisan: (id: string) => ['artisans', id] as const,
    bookings: ['bookings'] as const,
    booking: (id: string) => ['bookings', id] as const,
    conversations: ['conversations'] as const,
    messages: (conversationId: string) => ['messages', conversationId] as const,
    notifications: ['notifications'] as const,
    tracking: (bookingId: string) => ['tracking', bookingId] as const,
    favoris: ['favoris'] as const,
    myReferrals: ['referral', 'mine'] as const,
    // Main-d'œuvre
    travailleurSearch: (params: Record<string, unknown>) =>
        ['travailleurs', 'search', params] as const,
    travailleur: (id: string) => ['travailleurs', id] as const,
    monProfilTravailleur: ['travailleurs', 'me'] as const,
    mesAnnonces: ['annonces', 'mes'] as const,
    annoncesAutour: (params: Record<string, unknown>) => ['annonces', 'autour', params] as const,
    candidatsAnnonce: (annonceId: string) => ['annonces', annonceId, 'candidats'] as const,
};
