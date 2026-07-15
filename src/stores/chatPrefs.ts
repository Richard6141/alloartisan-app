import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Préférences des discussions (stockées LOCALEMENT sur le téléphone,
 * comme WhatsApp : elles n'ont pas à transiter par le serveur).
 */

const KEY = 'aa_chat_prefs';

export type TextScale = 'petit' | 'normal' | 'grand';

export const TEXT_SCALE_FACTOR: Record<TextScale, number> = {
    petit: 0.88,
    normal: 1,
    grand: 1.18,
};

interface ChatPrefsState {
    hydrated: boolean;
    /** Télécharger et afficher automatiquement photos/vidéos (off = économise les données) */
    autoDownloadMedia: boolean;
    /** Taille du texte des bulles */
    textScale: TextScale;
    /** Vibrations sur messages/notifications in-app */
    haptics: boolean;
    hydrate: () => Promise<void>;
    setPref: <K extends 'autoDownloadMedia' | 'textScale' | 'haptics'>(
        key: K,
        value: ChatPrefsState[K],
    ) => void;
}

export const useChatPrefs = create<ChatPrefsState>((set, get) => ({
    hydrated: false,
    autoDownloadMedia: true,
    textScale: 'normal',
    haptics: true,

    async hydrate() {
        try {
            const raw = await AsyncStorage.getItem(KEY);
            if (raw) {
                const saved = JSON.parse(raw) as Partial<ChatPrefsState>;
                set({
                    autoDownloadMedia: saved.autoDownloadMedia ?? true,
                    textScale: saved.textScale ?? 'normal',
                    haptics: saved.haptics ?? true,
                });
            }
        } catch {
            // Prefs illisibles : défauts conservés
        }
        set({ hydrated: true });
    },

    setPref(key, value) {
        set({ [key]: value } as Partial<ChatPrefsState>);
        // set() est synchrone : get() renvoie déjà l'état à jour
        const { autoDownloadMedia, textScale, haptics } = get();
        void AsyncStorage.setItem(KEY, JSON.stringify({ autoDownloadMedia, textScale, haptics }));
    },
}));
