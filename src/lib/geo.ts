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

/** Arrondi ~100 m : assez précis pour les distances, stable pour le cache serveur. */
function arrondir(coords: { latitude: number; longitude: number }) {
    return {
        latitude: Math.round(coords.latitude * 1000) / 1000,
        longitude: Math.round(coords.longitude * 1000) / 1000,
    };
}

/** Dernière position connue si elle est assez récente (quasi instantané). */
async function positionEnCache(): Promise<{ latitude: number; longitude: number } | null> {
    try {
        const last = await Location.getLastKnownPositionAsync({
            maxAge: 3 * 60 * 1000, // ≤ 3 min
            requiredAccuracy: 1000, // ≤ 1 km : suffisant pour ville / rayon de recherche
        });
        return last ? arrondir(last.coords) : null;
    } catch {
        return null;
    }
}

/**
 * Coordonnées seules, sans géocodage (rapide, hors ligne OK).
 * OPTIMISATION VITESSE : on renvoie d'abord la DERNIÈRE POSITION CONNUE
 * (instantanée) ; on ne déclenche un vrai relevé GPS (plus lent) que s'il n'y
 * a pas de cache récent. Pour un champ « ville » ou un rayon, c'est parfait.
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

        const cache = await positionEnCache();
        if (cache) return cache;

        const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });
        return arrondir(pos.coords);
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

        // Vitesse : dernière position connue si récente, sinon vrai relevé
        let coords = await positionEnCache();
        if (!coords) {
            const pos = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            coords = arrondir(pos.coords);
        }

        // Les deux géocodeurs en parallèle : OSM pour la précision des
        // quartiers, celui du téléphone comme repli (et pour la ville)
        const [osm, [place]] = await Promise.all([
            nominatimReverse(coords.latitude, coords.longitude),
            Location.reverseGeocodeAsync(coords).catch(() => [] as Location.LocationGeocodedAddress[]),
        ]);

        return {
            latitude: coords.latitude,
            longitude: coords.longitude,
            // Replis élargis (couverture géocodage faible au Bénin) : ville, puis
            // commune/sous-région, puis quartier, puis région — pour éviter un
            // champ « ville » vide. L'utilisateur peut de toute façon le corriger.
            ville:
                place?.city ??
                osm?.ville ??
                place?.subregion ??
                osm?.quartier ??
                place?.region ??
                null,
            // Mieux vaut un champ vide qu'un mauvais quartier : pas de repli
            // sur le nom de rue
            quartier: osm?.quartier ?? place?.district ?? null,
        };
    } catch {
        return null;
    }
}
