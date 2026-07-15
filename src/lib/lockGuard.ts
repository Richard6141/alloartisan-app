/**
 * Garde du verrou biométrique.
 *
 * Ouvrir la galerie, la caméra, le navigateur de paiement ou la feuille de
 * partage met l'app en arrière-plan : sans cette garde, l'empreinte se
 * déclenchait au retour et CASSAIT le flux en cours (fichier désélectionné,
 * paiement interrompu…).
 *
 * Chaque flux interne appelle suppressLock() JUSTE AVANT de quitter l'app ;
 * le verrou est suspendu au plus 2 minutes (filet de sécurité : si
 * l'utilisateur abandonne l'app depuis la galerie, le verrou reprend).
 */

let suppressUntil = 0;

/** À appeler juste avant d'ouvrir galerie / caméra / navigateur / partage */
export function suppressLock(durationMs = 2 * 60 * 1000): void {
    suppressUntil = Date.now() + durationMs;
}

export function isLockSuppressed(): boolean {
    return Date.now() < suppressUntil;
}

/** Au retour au premier plan : la suspension ne vaut que pour UN aller-retour */
export function clearLockSuppression(): void {
    suppressUntil = 0;
}
