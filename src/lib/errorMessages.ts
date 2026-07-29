/**
 * Traduction des messages d'erreur backend en français présentable.
 *
 * Les messages techniques de class-validator (« property X should not exist »,
 * « X must be an email »…) ne doivent JAMAIS atteindre l'utilisateur tels
 * quels. Extrait de `api.ts` pour être testable isolément (aucune dépendance
 * réseau/native).
 *
 * @returns un message FR, ou `null` si `raw` est vide/absent.
 */
export function translateMessage(raw: string | undefined): string | null {
    if (!raw) return null;

    const technical: [RegExp, string][] = [
        [
            /property .+ should not exist/i,
            "Une information inattendue a été envoyée. Mettez à jour l'application puis réessayez.",
        ],
        [/must be an email/i, 'Adresse email invalide.'],
        [/must be longer than or equal to (\d+)/i, 'Ce champ est trop court.'],
        [/must be shorter than or equal to (\d+)/i, 'Ce champ est trop long.'],
        [/must be a string/i, 'Format de champ invalide.'],
        [/must be a number/i, 'Ce champ doit être un nombre.'],
        [/must be a UUID/i, 'Identifiant invalide.'],
        [/should not be empty/i, 'Un champ obligatoire est vide.'],
        [/unauthorized/i, 'Session expirée. Reconnectez-vous.'],
        [/forbidden resource/i, "Vous n'avez pas accès à cette action."],
        [/internal server error/i, 'Erreur du serveur. Réessayez dans un instant.'],
        [/too many requests/i, 'Trop de tentatives. Patientez un instant.'],
    ];

    for (const [pattern, replacement] of technical) {
        if (pattern.test(raw)) return replacement;
    }
    return raw; // Déjà en français (le back-end écrit ses messages métier en français)
}
