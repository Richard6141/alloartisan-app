/**
 * Réactivité de l'artisan : mise en forme du temps de réponse moyen.
 *
 * Ce chiffre (calculé côté serveur au moment où l'artisan accepte une demande)
 * rassure le client : il voit qu'il obtiendra une réponse rapidement, ce qui
 * pousse à la prise de contact.
 */

/** « ~12 min », « ~2 h »… ou null si pas encore de donnée fiable. */
export function formatTempsReponse(minutes?: number | null): string | null {
    if (minutes == null || minutes <= 0) return null;
    if (minutes < 60) return `~${minutes} min`;
    const heures = Math.round(minutes / 60);
    return `~${heures} h`;
}

/** true si l'artisan répond vite (badge « Répond vite »). */
export function repondVite(minutes?: number | null): boolean {
    return minutes != null && minutes > 0 && minutes <= 30;
}
