import * as Location from 'expo-location';

/**
 * Résolution de position partagée : coordonnées GPS réelles du téléphone
 * + ville/quartier déduits par géocodage inverse.
 *
 * Précision : le géocodeur du téléphone (Google) renvoie souvent la rue ou
 * l'arrondissement au Bénin. On croise donc avec OpenStreetMap (Nominatim),
 * dont les quartiers de Cotonou/Calavi sont bien cartographiés — même source
 * que nos cartes. Le géocodeur local reste le repli hors ligne.
 *
 * ANTI-FRAUDE : côté artisan, la ville n'est jamais saisie à la main, elle
 * découle de cette position réelle. Un artisan ne peut donc pas prétendre
 * exercer à Cotonou depuis Parakou pour capter des clients.
 */

export interface PositionResolue {
    latitude: number;
    longitude: number;
    ville: string | null;
    quartier: string | null;
}

interface LieuNominatim {
    ville: string | null;
    quartier: string | null;
}

/** Géocodage inverse OpenStreetMap : le plus précis pour les quartiers béninois */
async function nominatimReverse(latitude: number, longitude: number): Promise<LieuNominatim | null> {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const url =
            'https://nominatim.openstreetmap.org/reverse?format=jsonv2' +
            `&lat=${latitude}&lon=${longitude}&zoom=16&accept-language=fr`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'AlloArtisan/1.0 (application mobile Benin)' },
            signal: controller.signal,
        });
        clearTimeout(timer);
        if (!response.ok) return null;
        const data = (await response.json()) as {
            address?: Record<string, string | undefined>;
        };
        const a = data.address ?? {};
        return {
            // Du plus local au plus large — jamais la rue, qui n'est pas un quartier
            quartier:
                a.suburb ?? a.neighbourhood ?? a.quarter ?? a.hamlet ?? a.village ?? null,
            ville: a.city ?? a.town ?? a.municipality ?? null,
        };
    } catch {
        return null;
    }
}

/**
 * Coordonnées seules, sans géocodage (rapide, hors ligne OK), arrondies à
 * ~100 m : assez précis pour des distances, stable pour le cache serveur.
 */
export async function resolveCoords(options?: {
    request?: boolean;
}): Promise<{ latitude: number; longitude: number } | null> {
    try {
        let { granted } = await Location.getForegroundPermissionsAsync();
        if (!granted && options?.request !== false) {
            granted = (await Location.requestForegroundPermissionsAsync()).granted;
        }
        if (!granted) return null;
        const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });
        return {
            latitude: Math.round(pos.coords.latitude * 1000) / 1000,
            longitude: Math.round(pos.coords.longitude * 1000) / 1000,
        };
    } catch {
        return null;
    }
}

export async function resolvePosition(options?: {
    /** false = ne jamais afficher la demande de permission (mode silencieux) */
    request?: boolean;
}): Promise<PositionResolue | null> {
    try {
        let { granted } = await Location.getForegroundPermissionsAsync();
        if (!granted && options?.request !== false) {
            granted = (await Location.requestForegroundPermissionsAsync()).granted;
        }
        if (!granted) return null;

        const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });

        // Les deux géocodeurs en parallèle : OSM pour la précision des
        // quartiers, celui du téléphone comme repli (et pour la ville)
        const [osm, [place]] = await Promise.all([
            nominatimReverse(pos.coords.latitude, pos.coords.longitude),
            Location.reverseGeocodeAsync(pos.coords).catch(() => [] as Location.LocationGeocodedAddress[]),
        ]);

        return {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            ville: place?.city ?? osm?.ville ?? place?.subregion ?? null,
            // Mieux vaut un champ vide qu'un mauvais quartier : pas de repli
            // sur le nom de rue
            quartier: osm?.quartier ?? place?.district ?? null,
        };
    } catch {
        return null;
    }
}
