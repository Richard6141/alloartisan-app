import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { tokenStorage } from './storage';
import { getDeviceId } from './device';
import { translateMessage } from './errorMessages';
import type { AuthTokens } from '../types/api';

/**
 * Client API AlloArtisan.
 *
 * - URL auto-détectée en dev (IP du serveur Expo → même machine que l'API)
 * - Bearer token injecté automatiquement
 * - Refresh token silencieux sur 401, avec file d'attente : si 5 requêtes
 *   échouent en même temps, UN seul refresh part, les autres attendent.
 */

function resolveBaseUrl(): string {
    const fromEnv = process.env.EXPO_PUBLIC_API_URL;
    if (fromEnv) return fromEnv;

    // En dev : l'API tourne sur la même machine que le bundler Expo
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
        const host = hostUri.split(':')[0];
        return `http://${host}:3001/api/v1`;
    }
    return 'http://10.0.2.2:3001/api/v1';
}

export const API_BASE_URL = resolveBaseUrl();

export const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 20000,
    headers: { 'Content-Type': 'application/json' },
});

/** Erreur API normalisée pour l'affichage */
export class ApiError extends Error {
    status: number;
    /** Code métier du back-end (ex. paywall : ABONNEMENT_REQUIS, QUOTA_EPUISE) */
    code?: string;
    constructor(status: number, message: string, code?: string) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

// ─── Injection du token ──────────────────────────────────────────────────────

api.interceptors.request.use(async (config) => {
    const token = await tokenStorage.getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    // Identifiant d'appareil (anti multi-comptes, non bloquant)
    try {
        config.headers['X-Device-Id'] = await getDeviceId();
    } catch {
        // ignore
    }
    return config;
});

// ─── Refresh silencieux avec file d'attente ──────────────────────────────────

let refreshPromise: Promise<string | null> | null = null;
let onSessionExpired: (() => void) | null = null;

/** Le store auth s'enregistre ici pour être déconnecté si le refresh échoue */
export function setSessionExpiredHandler(handler: () => void) {
    onSessionExpired = handler;
}

/**
 * Retourne un access token VALIDE : si celui en stock expire dans moins de
 * 30 s (ou est déjà expiré), il est rafraîchi d'abord. Utilisé par les
 * WebSockets, dont l'authentification ne passe pas par l'intercepteur.
 */
export async function ensureFreshAccessToken(): Promise<string | null> {
    const token = await tokenStorage.getAccessToken();
    if (!token) return null;

    try {
        const payloadB64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const { exp } = JSON.parse(globalThis.atob(payloadB64)) as { exp?: number };
        if (exp && exp * 1000 - Date.now() > 30000) return token;
    } catch {
        return token; // illisible : on laisse le serveur trancher
    }

    refreshPromise ??= refreshTokens().finally(() => {
        refreshPromise = null;
    });
    return refreshPromise;
}

async function refreshTokens(): Promise<string | null> {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (!refreshToken) return null;
    try {
        const { data } = await axios.post<AuthTokens>(
            `${API_BASE_URL}/auth/refresh`,
            {},
            { headers: { Authorization: `Bearer ${refreshToken}` }, timeout: 15000 },
        );
        await tokenStorage.setTokens(data.access_token, data.refresh_token);
        return data.access_token;
    } catch (e) {
        const status = (e as AxiosError)?.response?.status;
        // Déconnecter UNIQUEMENT si la session est vraiment invalide (401/403).
        // Sur une erreur réseau / timeout / 5xx (fréquent en arrière-plan ou en
        // réseau instable), on GARDE les tokens → plus de déconnexion intempestive.
        if (status === 401 || status === 403) {
            await tokenStorage.clear();
            onSessionExpired?.();
        }
        return null;
    }
}

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
        const status = error.response?.status;

        // 401 → tenter UN refresh partagé, puis rejouer la requête une seule fois
        if (status === 401 && original && !original._retried && !original.url?.includes('/auth/')) {
            original._retried = true;
            refreshPromise ??= refreshTokens().finally(() => {
                refreshPromise = null;
            });
            const newToken = await refreshPromise;
            if (newToken) {
                original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
                return api.request(original);
            }
        }

        const data = error.response?.data as
            | { message?: string | string[]; code?: string }
            | undefined;
        const raw = Array.isArray(data?.message) ? data.message[0] : data?.message;
        const message =
            translateMessage(raw) ??
            (error.code === 'ECONNABORTED' || !error.response
                ? 'Connexion impossible. Vérifiez votre réseau.'
                : 'Une erreur est survenue. Réessayez.');

        return Promise.reject(new ApiError(status ?? 0, message, data?.code));
    },
);
