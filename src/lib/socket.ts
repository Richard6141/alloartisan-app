import { io, Socket } from 'socket.io-client';
import { API_BASE_URL, ensureFreshAccessToken } from './api';

/**
 * Gestion des connexions WebSocket (chat + tracking temps réel).
 *
 * - Connexion paresseuse : le socket n'est ouvert que quand un écran en a besoin
 * - Reconnexion automatique avec backoff (gérée par socket.io)
 * - Token JWT dans handshake.auth (le serveur le vérifie à la connexion)
 */

const SOCKET_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

type Namespace = '/chat' | '/tracking';

const sockets = new Map<Namespace, Socket>();

export async function getSocket(namespace: Namespace): Promise<Socket> {
    const existing = sockets.get(namespace);
    if (existing) {
        if (!existing.connected) existing.connect();
        return existing;
    }

    const socket = io(`${SOCKET_ORIGIN}${namespace}`, {
        // FONCTION et non objet : le token JWT expire en 15 min. Avec un objet
        // figé, chaque reconnexion automatique représenterait l'ancien token
        // pour toujours → rejet silencieux, plus jamais de temps réel.
        // Ici, un token FRAIS est lu à chaque tentative de connexion.
        auth: (cb) => {
            ensureFreshAccessToken()
                .then((token) => cb({ token }))
                .catch(() => cb({ token: null }));
        },
        // POLLING D'ABORD, websocket ensuite : le polling passe partout où le
        // REST passe (même HTTP), puis socket.io surclasse automatiquement en
        // WebSocket si possible. Avec websocket en premier, un échec ws sur le
        // réseau local laissait le temps réel mort SANS repli.
        transports: ['polling', 'websocket'],
        upgrade: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
    });

    sockets.set(namespace, socket);
    return socket;
}

/**
 * Force une reconnexion propre de tous les sockets ouverts, avec un token FRAIS.
 * À appeler au retour au premier plan : après un long arrière-plan, le socket
 * peut sembler « connecté » alors que le transport est mort (l'OS l'a coupé) —
 * socket.io ne le détecte qu'au timeout de ping. On relance donc le handshake
 * pour que les notifications temps réel reprennent immédiatement.
 */
export async function reconnectSockets(): Promise<void> {
    if (sockets.size === 0) return;
    await ensureFreshAccessToken().catch(() => null);
    for (const socket of sockets.values()) {
        socket.disconnect();
        socket.connect();
    }
}

/** Ferme tous les sockets (déconnexion utilisateur) */
export function closeSockets(): void {
    for (const socket of sockets.values()) {
        socket.removeAllListeners();
        socket.disconnect();
    }
    sockets.clear();
}
