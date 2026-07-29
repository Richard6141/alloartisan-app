import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mocks des dépendances (réseau/natif/stockage) — on teste la LOGIQUE du store.
jest.mock('../lib/api', () => ({
    api: { post: jest.fn(), get: jest.fn(), delete: jest.fn() },
    setSessionExpiredHandler: jest.fn(),
}));
jest.mock('../lib/storage', () => ({
    tokenStorage: { setTokens: jest.fn(), clear: jest.fn(), getAccessToken: jest.fn() },
    prefsStorage: {
        hasSeenOnboarding: jest.fn(),
        isBiometricLockEnabled: jest.fn(),
        markOnboardingSeen: jest.fn(),
    },
}));
jest.mock('../lib/socket', () => ({ closeSockets: jest.fn() }));
jest.mock('../lib/push', () => ({
    unregisterForPush: jest.fn(),
    resetPushRegistration: jest.fn(),
}));
jest.mock('../lib/queryClient', () => ({ queryClient: { clear: jest.fn() } }));
jest.mock('@react-native-google-signin/google-signin', () => ({ GoogleSignin: {} }));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

import { useAuth } from './auth';
import { api } from '../lib/api';
import { tokenStorage } from '../lib/storage';
import { unregisterForPush, resetPushRegistration } from '../lib/push';

const post = jest.mocked(api.post);
const get = jest.mocked(api.get);
const setTokens = jest.mocked(tokenStorage.setTokens);
const tokenClear = jest.mocked(tokenStorage.clear);
const unregister = jest.mocked(unregisterForPush);
const resetPush = jest.mocked(resetPushRegistration);

const USER = { id: 'u1', email: 'a@b.co' };

beforeEach(() => {
    jest.clearAllMocks();
    useAuth.setState({ status: 'loading', user: null });
});

describe('useAuth.login', () => {
    it('ouvre la session quand le back renvoie des tokens', async () => {
        post.mockResolvedValue({ data: { access_token: 'at', refresh_token: 'rt' } } as never);
        get.mockResolvedValue({ data: USER } as never);

        const res = await useAuth.getState().login('a@b.co', 'pw');

        expect(res).toBeUndefined();
        expect(setTokens).toHaveBeenCalledWith('at', 'rt');
        expect(useAuth.getState().status).toBe('authenticated');
        expect(useAuth.getState().user).toEqual(USER);
    });

    it('renvoie mfaRequired sans ouvrir de session si 2FA activée', async () => {
        post.mockResolvedValue({ data: { mfa_required: true, mfa_token: 'mtok' } } as never);

        const res = await useAuth.getState().login('a@b.co', 'pw');

        expect(res).toEqual({ mfaRequired: true, mfaToken: 'mtok' });
        expect(setTokens).not.toHaveBeenCalled();
        expect(useAuth.getState().status).toBe('loading'); // inchangé
    });

    it('lève une erreur si la réponse est inattendue (ni tokens ni mfa)', async () => {
        post.mockResolvedValue({ data: {} } as never);

        await expect(useAuth.getState().login('a@b.co', 'pw')).rejects.toThrow(/inattendue/i);
        expect(useAuth.getState().status).toBe('loading');
    });
});

describe('useAuth.logout', () => {
    it('déconnexion EXPLICITE : désenregistre le push FCM et passe en guest', async () => {
        post.mockResolvedValue({ data: {} } as never);
        useAuth.setState({ status: 'authenticated', user: USER as never });

        await useAuth.getState().logout(true);

        expect(unregister).toHaveBeenCalled();
        expect(resetPush).not.toHaveBeenCalled();
        expect(tokenClear).toHaveBeenCalled();
        expect(useAuth.getState().status).toBe('guest');
        expect(useAuth.getState().user).toBeNull();
    });

    // Distinction critique documentée dans le store : une expiration NE doit PAS
    // désenregistrer le token FCM (sinon plus de notifications à la reconnexion).
    it('déconnexion par EXPIRATION : garde le token FCM (reset marqueur, pas de désenregistrement)', async () => {
        useAuth.setState({ status: 'authenticated', user: USER as never });

        await useAuth.getState().logout(false);

        expect(unregister).not.toHaveBeenCalled();
        expect(resetPush).toHaveBeenCalled();
        expect(tokenClear).toHaveBeenCalled();
        expect(useAuth.getState().status).toBe('guest');
    });
});
