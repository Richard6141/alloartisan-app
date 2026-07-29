import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { suppressLock, isLockSuppressed, clearLockSuppression } from './lockGuard';

describe('lockGuard', () => {
    afterEach(() => {
        clearLockSuppression();
        jest.useRealTimers();
    });

    it("n'est pas supprimé par défaut", () => {
        expect(isLockSuppressed()).toBe(false);
    });

    it('suppressLock suspend le verrou', () => {
        suppressLock();
        expect(isLockSuppressed()).toBe(true);
    });

    it('clearLockSuppression réactive le verrou immédiatement (un seul aller-retour)', () => {
        suppressLock();
        clearLockSuppression();
        expect(isLockSuppressed()).toBe(false);
    });

    it('la suppression expire après la durée (filet de sécurité 2 min)', () => {
        jest.useFakeTimers();
        suppressLock(1000);
        expect(isLockSuppressed()).toBe(true);
        jest.advanceTimersByTime(1001);
        expect(isLockSuppressed()).toBe(false);
    });
});
