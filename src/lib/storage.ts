import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Stockage local :
 * - SecureStore (chiffré natif) → tokens d'authentification uniquement
 * - AsyncStorage → préférences non sensibles + cache offline TanStack Query
 */

const ACCESS_TOKEN = 'aa_access_token';
const REFRESH_TOKEN = 'aa_refresh_token';
const ONBOARDING_SEEN = 'aa_onboarding_seen';
const BIOMETRIC_LOCK = 'aa_biometric_lock';
const BG_PROMPT_SEEN = 'aa_bg_prompt_seen';

export const tokenStorage = {
    async getAccessToken(): Promise<string | null> {
        return SecureStore.getItemAsync(ACCESS_TOKEN);
    },
    async getRefreshToken(): Promise<string | null> {
        return SecureStore.getItemAsync(REFRESH_TOKEN);
    },
    async setTokens(accessToken: string, refreshToken: string): Promise<void> {
        await Promise.all([
            SecureStore.setItemAsync(ACCESS_TOKEN, accessToken),
            SecureStore.setItemAsync(REFRESH_TOKEN, refreshToken),
        ]);
    },
    async clear(): Promise<void> {
        await Promise.all([
            SecureStore.deleteItemAsync(ACCESS_TOKEN),
            SecureStore.deleteItemAsync(REFRESH_TOKEN),
        ]);
    },
};

export const prefsStorage = {
    async hasSeenOnboarding(): Promise<boolean> {
        return (await AsyncStorage.getItem(ONBOARDING_SEEN)) === '1';
    },
    async markOnboardingSeen(): Promise<void> {
        await AsyncStorage.setItem(ONBOARDING_SEEN, '1');
    },
    /** Verrouillage biométrique de l'app (empreinte / visage) */
    async isBiometricLockEnabled(): Promise<boolean> {
        return (await AsyncStorage.getItem(BIOMETRIC_LOCK)) === '1';
    },
    async setBiometricLock(enabled: boolean): Promise<void> {
        await AsyncStorage.setItem(BIOMETRIC_LOCK, enabled ? '1' : '0');
    },
    /** Invite « réception en arrière-plan » (exemption batterie) déjà proposée ? */
    async hasSeenBackgroundPrompt(): Promise<boolean> {
        return (await AsyncStorage.getItem(BG_PROMPT_SEEN)) === '1';
    },
    async markBackgroundPromptSeen(): Promise<void> {
        await AsyncStorage.setItem(BG_PROMPT_SEEN, '1');
    },
};
