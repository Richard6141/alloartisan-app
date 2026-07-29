import { describe, it, expect } from '@jest/globals';
import { translateMessage } from './errorMessages';

describe('translateMessage', () => {
    it('renvoie null pour une entrée vide/absente', () => {
        expect(translateMessage(undefined)).toBeNull();
        expect(translateMessage('')).toBeNull();
    });

    it('traduit les messages techniques class-validator en FR', () => {
        expect(translateMessage('email must be an email')).toBe('Adresse email invalide.');
        expect(translateMessage('property foo should not exist')).toMatch(/Mettez à jour/);
        expect(translateMessage('code should not be empty')).toBe('Un champ obligatoire est vide.');
        expect(translateMessage('Unauthorized')).toBe('Session expirée. Reconnectez-vous.');
        expect(translateMessage('Too Many Requests')).toBe('Trop de tentatives. Patientez un instant.');
    });

    it('laisse passer un message métier déjà en français', () => {
        const fr = 'Vous avez atteint votre quota de mises en relation ce mois-ci.';
        expect(translateMessage(fr)).toBe(fr);
    });

    it("n'expose jamais le jargon technique brut à l'utilisateur", () => {
        const out = translateMessage('password must be longer than or equal to 8 characters');
        expect(out).toBe('Ce champ est trop court.');
        expect(out).not.toMatch(/must be longer/i);
    });
});
