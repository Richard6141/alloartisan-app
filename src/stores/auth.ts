import { create } from 'zustand';
import * as LocalAuthentication from 'expo-local-authentication';
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
    login: (email: string, password: string) => Promise<void>;
    register: (payload: { email: string; password: string; role: 'CLIENT' | 'ARTISAN' }) => Promise<void>;
    verifyOtp: (email: string, code: string) => Promise<void>;
    refreshUser: () => Promise<void>;
    logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
    status: 'loading',
    user: null,

    /** Au démarrage : onboarding vu ? token valide ? profil chargeable ? */
    async hydrate() {
        setSessionExpiredHandler(() => {
            void get().logout();
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

    async logout() {
        await unregisterForPush();
        await tokenStorage.clear();
        closeSockets();
        queryClient.clear();
        set({ status: 'guest', user: null });
    },
}));
