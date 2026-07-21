import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';

/**
 * Réception des notifications APP FERMÉE sur les surcouches agressives.
 *
 * Contexte : les téléphones Transsion (Tecno / Infinix / iTel — très répandus
 * au Bénin) et d'autres OEM coupent la remise FCM aux apps non « autorisées à
 * fonctionner en arrière-plan ». Le pipeline serveur→FCM est déjà optimal
 * (message `notification`, priorité haute) : seul l'OS bloque. On aide donc
 * l'utilisateur à mettre AlloArtisan en liste blanche :
 *   1. exemption d'optimisation batterie (dialogue système, 1 tap, cross-OEM) ;
 *   2. auto-démarrage (réglage propriétaire, non déclenchable → on guide).
 *
 * iOS n'a pas ce problème (APNs gère la remise) → tout est no-op hors Android.
 */

/** Nom de package Android, pour cibler les dialogues système sur CETTE app. */
const PACKAGE =
    (Constants.expoConfig?.android?.package as string | undefined) ?? 'bj.alloartisan.app';

export type DeviceBrandKey = 'tecno' | 'infinix' | 'itel' | 'xiaomi' | 'oppo' | 'vivo' | 'other';

/** Marque normalisée (minuscule) à partir de fabricant + marque. */
function rawBrand(): string {
    return `${Device.manufacturer ?? ''} ${Device.brand ?? ''}`.toLowerCase();
}

export function getDeviceBrand(): DeviceBrandKey {
    const b = rawBrand();
    if (b.includes('tecno')) return 'tecno';
    if (b.includes('infinix')) return 'infinix';
    if (b.includes('itel')) return 'itel';
    if (b.includes('xiaomi') || b.includes('redmi') || b.includes('poco')) return 'xiaomi';
    if (b.includes('oppo') || b.includes('realme')) return 'oppo';
    if (b.includes('vivo') || b.includes('iqoo')) return 'vivo';
    return 'other';
}

/** Groupe Transsion : les plus agressifs, et majoritaires au Bénin. */
export function isTranssionBrand(): boolean {
    const k = getDeviceBrand();
    return k === 'tecno' || k === 'infinix' || k === 'itel';
}

/** Marques connues pour bloquer FCM en arrière-plan sans mise en liste blanche. */
export function isAggressiveOem(): boolean {
    return Platform.OS === 'android' && getDeviceBrand() !== 'other';
}

/**
 * Dialogue système « Autoriser <app> à fonctionner en arrière-plan ? » (exemption
 * d'optimisation batterie). Cible CETTE app via `data: package:…`. C'est le
 * levier le plus fiable et le seul déclenchable en un tap sur toutes surcouches.
 * No-op (retourne false) hors Android ou si l'intent n'est pas disponible.
 */
export async function requestBatteryExemption(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
        await IntentLauncher.startActivityAsync(
            IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            { data: `package:${PACKAGE}` },
        );
        return true;
    } catch {
        // Certaines ROM refusent l'action ciblée : repli sur la LISTE générale.
        try {
            await IntentLauncher.startActivityAsync(
                IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS,
            );
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Ouvre la fiche « Infos de l'application » d'AlloArtisan. C'est de là que
 * l'utilisateur atteint « Batterie », « Auto-démarrage » et « Notifications »
 * sur la plupart des surcouches. Fiable partout (contrairement aux écrans
 * d'auto-démarrage propriétaires, non exposés et qui peuvent planter).
 */
export async function openAppSettings(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
        await IntentLauncher.startActivityAsync(
            IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
            { data: `package:${PACKAGE}` },
        );
        return true;
    } catch {
        return false;
    }
}

/** Étapes d'auto-démarrage à afficher, adaptées à la marque détectée. */
export interface BrandGuide {
    /** Nom lisible de la surcouche (pour le titre). */
    label: string;
    /** Chemin de réglage à suivre, une étape par ligne. */
    steps: string[];
}

export function getBrandGuide(): BrandGuide {
    switch (getDeviceBrand()) {
        case 'tecno':
        case 'infinix':
        case 'itel':
            return {
                label: 'Tecno / Infinix / iTel',
                steps: [
                    'Réglages → Batterie → sélectionner AlloArtisan',
                    'Choisir « Aucune restriction » (ou « Autoriser l’activité en arrière-plan »)',
                    'Réglages → « Gestionnaire du téléphone » ou « Sécurité » → « Auto-démarrage / Démarrage auto »',
                    'Activer AlloArtisan dans la liste',
                    'Dans les Applications récentes : appui long sur AlloArtisan → « Verrouiller » (cadenas) pour l’empêcher d’être fermée',
                ],
            };
        case 'xiaomi':
            return {
                label: 'Xiaomi / Redmi / POCO',
                steps: [
                    'Réglages → Applications → AlloArtisan → « Économie de batterie » → « Aucune restriction »',
                    'Réglages → Applications → AlloArtisan → « Démarrage automatique » → activer',
                    'Applications récentes : appui long sur AlloArtisan → cadenas pour la verrouiller',
                ],
            };
        case 'oppo':
            return {
                label: 'Oppo / Realme (ColorOS)',
                steps: [
                    'Réglages → Batterie → AlloArtisan → « Autoriser l’activité en arrière-plan »',
                    'Réglages → Gestion des applications → Démarrage automatique → activer AlloArtisan',
                ],
            };
        case 'vivo':
            return {
                label: 'Vivo / iQOO (Funtouch/OriginOS)',
                steps: [
                    'Réglages → Batterie → Consommation en arrière-plan élevée → autoriser AlloArtisan',
                    'Réglages → Autres réglages → Applications au démarrage → activer AlloArtisan',
                ],
            };
        default:
            return {
                label: 'Android',
                steps: [
                    'Réglages → Applications → AlloArtisan → Batterie → « Sans restriction »',
                    'Si un « démarrage automatique » existe dans les réglages, activez-le pour AlloArtisan',
                ],
            };
    }
}
