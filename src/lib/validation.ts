/**
 * Validations partagées côté client.
 *
 * `validatePassword` reflète EXACTEMENT la règle de complexité du serveur
 * (`@Matches` dans les DTO d'auth : 8+ caractères, une majuscule, une
 * minuscule, un chiffre, un caractère spécial). La garder ici en un seul
 * endroit évite les divergences écran par écran — une règle plus faible côté
 * client laisse passer un mot de passe que le serveur refuse ensuite (400),
 * ce qui a déjà causé des « je change mon mot de passe et ça ne marche pas ».
 *
 * Retourne `null` si le mot de passe est valide, sinon un message FR court
 * décrivant la première exigence manquante.
 */
export function validatePassword(pwd: string): string | null {
    if (pwd.length < 8) return 'Au moins 8 caractères';
    if (!/[A-Z]/.test(pwd)) return 'Au moins une majuscule';
    if (!/[a-z]/.test(pwd)) return 'Au moins une minuscule';
    if (!/[0-9]/.test(pwd)) return 'Au moins un chiffre';
    if (!/[^A-Za-z0-9]/.test(pwd)) return 'Au moins un caractère spécial (!, @, #…)';
    return null;
}
