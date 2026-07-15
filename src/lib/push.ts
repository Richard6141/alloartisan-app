import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import type { useRouter } from 'expo-router';
import { api } from './api';

type AppRouter = ReturnType<typeof useRouter>;

/**
 * Notifications push (FCM) — réception MÊME app fermée + son.
 *
 * Le back-end envoie via Firebase Cloud Messaging (firebase-admin) : l'app doit
 * donc lui transmettre un TOKEN FCM NATIF (getDevicePushTokenAsync), pas un
 * token Expo. Cela n'a d'effet que dans un build EAS (APK) : Expo Go ne reçoit
 * plus les push distants sur Android — c'est une limite d'Expo Go, pas un bug.
 */

/** Doit rester identique au channelId utilisé côté back (sendPushNotification). */
export const PUSH_CHANNEL_ID = 'alloartisan-notifications';

// Présentation quand une notif arrive PENDANT que l'app est au premier plan :
// on JOUE LE SON (c'est ce qui manquait) mais on n'empile pas de bannière
// système — la bannière in-app « façon WhatsApp » (RealtimeBridge) suffit.
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: false,
        shouldShowList: true,
    }),
});

let currentToken: string | null = null;

/** Canal Android obligatoire pour un SON + priorité haute (Android 8+). */
export async function ensureAndroidChannel(): Promise<void> {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
        name: 'Notifications AlloArtisan',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1E3A8A',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
}

/**
 * À appeler une fois l'utilisateur authentifié : demande la permission,
 * récupère le token FCM et l'enregistre côté serveur.
 */
export async function registerForPush(): Promise<void> {
    try {
        // Émulateur / web : pas de vrai token push
        if (!Device.isDevice) return;

        await ensureAndroidChannel();

        const existing = await Notifications.getPermissionsAsync();
        let granted = existing.granted;
        if (!granted && existing.canAskAgain) {
            const asked = await Notifications.requestPermissionsAsync();
            granted = asked.granted;
        }
        if (!granted) return;

        // Token FCM natif (chaîne). Échoue silencieusement hors build FCM.
        const devToken = await Notifications.getDevicePushTokenAsync();
        const token = String(devToken.data);
        if (!token || token === currentToken) return;
        currentToken = token;

        const deviceName =
            [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || Platform.OS;
        await api.post('/notifications/fcm-token', { token, deviceName });
    } catch {
        // Jamais bloquant (Expo Go, permission refusée, hors ligne…)
    }
}

/** À la déconnexion : désactiver le token pour ne plus rien recevoir. */
export async function unregisterForPush(): Promise<void> {
    if (!currentToken) return;
    try {
        await api.delete('/notifications/fcm-token', { data: { token: currentToken } });
    } catch {
        // non bloquant
    }
    currentToken = null;
}

/**
 * Routage au TAP sur une notification (app en arrière-plan ou fermée).
 * S'appuie sur le champ `data` envoyé par le back (mêmes clés que le socket).
 */
export function useNotificationTapRouting(router: AppRouter): () => void {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = (response.notification.request.content.data ?? {}) as Record<string, string>;
        if (data.conversationId) {
            router.push({
                pathname: '/conversation/[id]',
                params: { id: data.conversationId, nom: data.senderNom ?? '' },
            });
        } else if (data.bookingId) {
            router.push({ pathname: '/booking/[id]', params: { id: data.bookingId } });
        } else if (data.screen === 'mes-annonces') {
            router.push('/mes-annonces');
        } else if (data.screen === 'main-doeuvre') {
            router.push('/annonces-chantier');
        } else {
            router.push('/notifications');
        }
    });
    return () => sub.remove();
}
