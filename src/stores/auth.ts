import { create } from 'zustand';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { api, setSessionExpiredHandler } from '../lib/api';
import { tokenStorage, prefsStorage } from '../lib/storage';
import { closeSockets } from '../lib/socket';
import { unregisterForPush } from '../lib/push';
import { queryClient } from '../lib/queryClient';
import type { AuthTokens, User } from '../types/api';

/**
 * Store d'authentification (Zustand).
 *
 * `status` pilote la navigation racine :
 * - 'loading'     → splash (hydratation en cours)
 * - 'onboarding'  → première ouverture de l'app
 * - 'guest'       → non connecté (peut naviguer en invité : accueil, recherche)
 * - 'authenticated' → connecté
 */

type AuthStatus = 'loading' | 'onboarding' | 'guest' | 'authenticated' | 'locked';

interface AuthState {
    status: AuthStatus;
    user: User | null;
    hydrate: () => Promise<void>;
    /** Déverrouillage biométrique (statut 'locked') */
    unlock: () => Promise<boolean>;
    /** Reverrouille l'app (retour en avant-plan avec empreinte activée) */
    lock: () => void;
    completeOnboarding: () => Promise<void>;
    /** Supprime définitivement le compte (mot de passe requis) */
    deleteAccount: (password: string) => Promise<void>;
    login: (email: string, password: string) => Promise<void>;
    /** Connexion / inscription via Google */
    loginWithGoogle: (role?: 'CLIENT' | 'ARTISAN') => Promise<void>;
    register: (payload: { email: string; password: string; role: 'CLIENT' | 'ARTISAN' }) => Promise<void>;
    verifyOtp: (email: string, code: string) => Promise<void>;
    refreshUser: () => Promise<void>;
    logout: (revokeServer?: boolean) => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
    status: 'loading',
    user: null,

    /** Au démarrage : onboarding vu ? token valide ? profil chargeable ? */
    async hydrate() {
        setSessionExpiredHandler(() => {
            // Session déjà invalide côté serveur : inutile d'appeler /auth/logout
            // (et on évite ainsi toute boucle 401 → refresh → logout). On nettoie
            // puis on REDIRIGE vers la connexion — sinon l'utilisateur reste sur
            // son écran avec une erreur « Session expirée » sans pouvoir agir.
            void get()
                .logout(false)
                .then(() => {
                    try {
                        router.replace('/(auth)/login');
                    } catch {
                        // navigation pas prête (démarrage) : le statut 'guest' suffit
                    }
                });
        });

        const seen = await prefsStorage.hasSeenOnboarding();
        if (!seen) {
            set({ status: 'onboarding' });
            return;
        }

        const token = await tokenStorage.getAccessToken();
        if (!token) {
            set({ status: 'guest' });
            return;
        }

        // Verrouillage biométrique activé → exiger l'empreinte avant d'entrer
        if (await prefsStorage.isBiometricLockEnabled()) {
            set({ status: 'locked' });
            return;
        }

        try {
            const { data } = await api.get<User>('/users/me');
            set({ status: 'authenticated', user: data });
        } catch {
            // Token invalide et refresh échoué → invité (l'intercepteur a nettoyé)
            set({ status: 'guest', user: null });
        }
    },

    lock() {
        set({ status: 'locked' });
    },

    async unlock() {
        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Déverrouillez AlloArtisan',
                cancelLabel: 'Annuler',
            });
            if (!result.success) return false;
        } catch {
            return false;
        }
        try {
            const { data } = await api.get<User>('/users/me');
            set({ status: 'authenticated', user: data });
        } catch {
            set({ status: 'guest', user: null });
        }
        return true;
    },

    async completeOnboarding() {
        await prefsStorage.markOnboardingSeen();
        set({ status: 'guest' });
    },

    async login(email, password) {
        const { data } = await api.post<AuthTokens & { mfaRequired?: boolean }>('/auth/login', {
            email,
            password,
        });
        if (!data.access_token) {
            // Compte avec MFA activé — parcours dédié à venir
            throw new Error(
                'Ce compte utilise la double authentification, non prise en charge dans cette version.',
            );
        }
        await tokenStorage.setTokens(data.access_token, data.refresh_token);
        const { data: user } = await api.get<User>('/users/me');
        set({ status: 'authenticated', user });
    },

    async loginWithGoogle(role) {
        const webClientId = (Constants.expoConfig?.extra as { googleWebClientId?: string })
            ?.googleWebClientId;
        GoogleSignin.configure({ webClientId, offlineAccess: false });
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const res = (await GoogleSignin.signIn()) as {
            idToken?: string;
            data?: { idToken?: string };
        };
        const idToken = res?.data?.idToken ?? res?.idToken;
        if (!idToken) throw new Error('Connexion Google impossible (aucun jeton reçu).');
        const { data } = await api.post<AuthTokens>('/auth/google', { idToken, role });
        await tokenStorage.setTokens(data.access_token, data.refresh_token);
        const { data: user } = await api.get<User>('/users/me');
        set({ status: 'authenticated', user });
    },

    async register({ email, password, role }) {
        // Le back renvoie directement les tokens ; l'email reste à vérifier (OTP)
        const { data } = await api.post<AuthTokens>('/auth/register', { email, password, role });
        await tokenStorage.setTokens(data.access_token, data.refresh_token);
    },

    async verifyOtp(email, code) {
        // En CHAÎNE : un code commençant par 0 perdrait son zéro en nombre
        await api.post('/auth/verify-otp', { email, code });
        const { data: user } = await api.get<User>('/users/me');
        set({ status: 'authenticated', user });
    },

    async refreshUser() {
        const { data } = await api.get<User>('/users/me');
        set({ user: data });
    },

    async logout(revokeServer = true) {
        // On ne désenregistre le token FCM QUE sur une déconnexion EXPLICITE de
        // l'utilisateur. En cas d'expiration automatique (revokeServer=false), on
        // garde le token : le push reprendra dès la reconnexion, sans trou.
        if (revokeServer) {
            await unregisterForPush();
            // Révoquer la session côté serveur (refresh token) tant que le token
            // d'accès est encore présent. Non bloquant : hors ligne / token expiré
            // → on nettoie quand même localement.
            try {
                await api.post('/auth/logout');
            } catch {
                // ignoré : la déconnexion locale prime
            }
        }
        await tokenStorage.clear();
        closeSockets();
        queryClient.clear();
        set({ status: 'guest', user: null });
    },

    async deleteAccount(password: string) {
        // Le serveur exige le mot de passe (vérifié en argon) puis anonymise
        // + soft-delete le compte. Ensuite on nettoie la session localement.
        await api.delete('/users/me', { data: { password } });
        await unregisterForPush();
        await tokenStorage.clear();
        closeSockets();
        queryClient.clear();
        set({ status: 'guest', user: null });
    },
}));
