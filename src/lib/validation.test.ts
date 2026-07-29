import { describe, it, expect } from '@jest/globals';
import { validatePassword } from './validation';

describe('validatePassword', () => {
    it('accepte un mot de passe conforme aux règles serveur', () => {
        expect(validatePassword('Abcdef1!')).toBeNull();
        expect(validatePassword('NewLife@2026')).toBeNull();
    });

    it('refuse un mot de passe trop court', () => {
        expect(validatePassword('Ab1!')).toBe('Au moins 8 caractères');
    });

    it('exige une majuscule', () => {
        expect(validatePassword('abcdef1!')).toBe('Au moins une majuscule');
    });

    // Cette règle manquait dans l'ancien validateur de register.tsx : un mot de
    // passe sans minuscule passait côté client puis était refusé (400) côté serveur.
    it('exige une minuscule', () => {
        expect(validatePassword('ABCDEF1!')).toBe('Au moins une minuscule');
    });

    it('exige un chiffre', () => {
        expect(validatePassword('Abcdefg!')).toBe('Au moins un chiffre');
    });

    it('exige un caractère spécial', () => {
        expect(validatePassword('Abcdefg1')).toBe('Au moins un caractère spécial (!, @, #…)');
    });
});
