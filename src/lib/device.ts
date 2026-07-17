import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Identifiant d'appareil stable (anti multi-comptes).
 *
 * Un UUID généré une seule fois puis conservé sur l'appareil. Envoyé en
 * en-tête « X-Device-Id » : le serveur plafonne le nombre de comptes créés
 * depuis un même appareil. Ce n'est PAS une donnée personnelle (aléatoire,
 * remis à zéro si l'app est réinstallée) — juste un garde-fou léger.
 */

const KEY = 'aa_device_id';
let cached: string | null = null;

/** UUID v4 sans dépendance (suffisant pour un identifiant d'appareil). */
function uuidv4(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export async function getDeviceId(): Promise<string> {
    if (cached) return cached;
    try {
        let id = await AsyncStorage.getItem(KEY);
        if (!id) {
            id = uuidv4();
            await AsyncStorage.setItem(KEY, id);
        }
        cached = id;
        return id;
    } catch {
        // Stockage indisponible : on renvoie un id éphémère (non bloquant)
        cached = uuidv4();
        return cached;
    }
}
