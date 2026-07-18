import { palette, colors } from '../../theme/tokens';

/**
 * Types & helpers partagés du back-office anti-fraude (score 0-100).
 * Miroir de `fraud.types.ts` côté backend.
 */

export type FraudNiveau = 'NORMAL' | 'SURVEILLANCE' | 'VERIFICATION' | 'BLOQUE';
export type FraudAction = 'AUCUNE' | 'LOG_ENHANCED' | 'NOTIF_ADMIN' | 'BLOCAGE_TEMP';

export interface FraudSignal {
    tauxAnnulation: number;
    mauvaisAvisRepetes: number;
    nouveauCompteGrosseMise: boolean;
    floodingDemandes: boolean;
    profilNonVerifieActif: number;
}

export interface FraudScore {
    artisanId: string;
    score: number;
    niveau: FraudNiveau;
    signaux: FraudSignal;
    action: FraudAction;
    calculatedAt: string;
}

export const NIVEAU_META: Record<FraudNiveau, { label: string; color: string }> = {
    NORMAL: { label: 'Normal', color: palette.green700 },
    SURVEILLANCE: { label: 'Surveillance', color: '#B45309' },
    VERIFICATION: { label: 'Vérification requise', color: palette.terracotta700 },
    BLOQUE: { label: 'Bloqué', color: colors.danger },
};

export const ACTION_LABEL: Record<FraudAction, string> = {
    AUCUNE: 'Aucune action',
    LOG_ENHANCED: 'Journalisation renforcée',
    NOTIF_ADMIN: 'Signalé pour revue admin',
    BLOCAGE_TEMP: 'Blocage temporaire automatique',
};

/** Couleur d'un score (badge) selon sa gravité. */
export function scoreColor(score: number): string {
    if (score <= 30) return palette.green600;
    if (score <= 60) return '#D97706';
    if (score <= 80) return palette.terracotta700;
    return colors.danger;
}
