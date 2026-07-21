import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import {
    useFonts,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { AppState, BackHandler, View, StyleSheet } from 'react-native';
import { queryClient, asyncStoragePersister, setupOnlineManagement } from '../lib/queryClient';
import { ensureFreshAccessToken } from '../lib/api';
import { reconnectSockets } from '../lib/socket';
import { prefsStorage } from '../lib/storage';
import { isLockSuppressed, clearLockSuppression } from '../lib/lockGuard';
import {
    registerForPush,
    setupPushTokenRotation,
    useNotificationTapRouting,
    consumeInitialNotification,
} from '../lib/push';
import { useAuth } from '../stores/auth';
import { useChatPrefs } from '../stores/chatPrefs';
import { OfflineBanner } from '../components/ui';
import { LockScreen } from '../components/LockScreen';
import { AnimatedSplash } from '../components/AnimatedSplash';
import { RealtimeBridge } from '../components/RealtimeBridge';
import { colors } from '../theme/tokens';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        PlusJakartaSans_400Regular,
        PlusJakartaSans_500Medium,
        PlusJakartaSans_600SemiBold,
        PlusJakartaSans_700Bold,
        PlusJakartaSans_800ExtraBold,
    });
    const status = useAuth((s) => s.status);
    const hydrate = useAuth((s) => s.hydrate);
    const router = useRouter();
    const [splashGone, setSplashGone] = useState(false);

    useEffect(() => {
        void hydrate();
        void useChatPrefs.getState().hydrate();
        return setupOnlineManagement();
    }, [hydrate]);

    // Bouton retour matériel (Android) : revenir DANS l'app dès qu'il y a un
    // historique, ne laisser le système quitter que depuis un écran racine.
    // Corrige le cas où l'appui « retour » fermait l'app au lieu de reculer.
    // Enregistré au niveau racine (donc exécuté avant le handler de navigation)
    // pour garantir un comportement cohérent partout.
    useEffect(() => {
        const onBack = () => {
            // App verrouillée : ne jamais quitter sur un appui retour
            if (useAuth.getState().status === 'locked') return true;
            if (router.canGoBack()) {
                router.back();
                return true;
            }
            return false; // écran racine → laisser le système fermer l'app
        };
        const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
        return () => sub.remove();
    }, [router]);

    // Empreinte : reverrouiller quand l'app passe en arrière-plan
    // (comme les apps bancaires : chaque retour exige l'empreinte).
    // EXCEPTION : les flux internes (galerie, caméra, paiement, partage)
    // suspendent le verrou via suppressLock() — sinon l'empreinte cassait
    // la sélection de fichier au retour de la galerie.
    useEffect(() => {
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'background') {
                if (isLockSuppressed()) return; // galerie / caméra / paiement…
                const { status: current, lock } = useAuth.getState();
                if (current === 'authenticated') {
                    void prefsStorage.isBiometricLockEnabled().then((enabled) => {
                        if (enabled) lock();
                    });
                }
            } else if (state === 'active') {
                // La suspension ne vaut que pour UN aller-retour
                clearLockSuppression();
                // Retour au premier plan : après un long arrière-plan (token
                // d'accès expiré, socket coupé par l'OS), on rafraîchit le token
                // PUIS on relance les sockets — pour que données ET notifications
                // temps réel reprennent immédiatement, sans action de l'utilisateur.
                if (useAuth.getState().status === 'authenticated') {
                    void ensureFreshAccessToken()
                        .catch(() => null)
                        .finally(() => {
                            void reconnectSockets();
                        });
                    // Le token FCM a pu tourner pendant l'arrière-plan (MAJ Play
                    // Services…). On ré-enregistre pour que le serveur pousse
                    // toujours vers le BON token, même app restée fermée.
                    void registerForPush();
                }
            }
        });
        return () => sub.remove();
    }, []);

    // Push : enregistrer le token FCM dès que l'utilisateur est authentifié
    // (les push arrivent alors même app fermée, avec son via le canal Android).
    useEffect(() => {
        if (status === 'authenticated') void registerForPush();
    }, [status]);

    // Rotation du token FCM : Firebase renouvelle le token sans prévenir. On
    // écoute ce changement pour mettre le serveur à jour immédiatement — sinon
    // il continue de pousser vers un token mort et l'utilisateur ne reçoit plus
    // rien, app fermée comprise. Branché une seule fois pour toute la session.
    useEffect(() => setupPushTokenRotation(), []);

    // Tap sur une notification (app ouverte / en arrière-plan) → écran concerné
    useEffect(() => useNotificationTapRouting(router), [router]);

    // App lancée À FROID par un tap sur une notification : router une fois prêt
    useEffect(() => {
        if (status === 'authenticated') void consumeInitialNotification(router);
    }, [status, router]);

    // Dès que les polices sont prêtes, on masque le splash NATIF : notre splash
    // animé (même fond navy) prend le relais sans coupure et gère la suite.
    useEffect(() => {
        if (fontsLoaded) {
            void SplashScreen.hideAsync();
        }
    }, [fontsLoaded]);

    // On a besoin des polices pour rendre le moindre texte. L'hydratation de
    // l'auth ('loading'), elle, se déroule DERRIÈRE le splash animé.
    if (!fontsLoaded) return null;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <PersistQueryClientProvider
                client={queryClient}
                persistOptions={{ persister: asyncStoragePersister, maxAge: 7 * 24 * 3600 * 1000 }}
            >
                <StatusBar style="dark" />
                <OfflineBanner />
                <RealtimeBridge />
                <Stack
                    screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: colors.background },
                        animation: 'slide_from_right',
                    }}
                />
                {/* Verrou biométrique en SUPERPOSITION (et non en remplacement) :
                    l'app reste vivante dessous — un vocal en cours de lecture
                    continue, les sockets restent connectés. Le contenu est
                    entièrement masqué par le fond opaque du LockScreen. */}
                {status === 'locked' && (
                    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
                        <LockScreen />
                    </View>
                )}

                {/* Splash animé par-dessus tout : joue le logo pendant
                    l'hydratation, puis disparaît en fondu. */}
                {!splashGone && (
                    <AnimatedSplash
                        appReady={status !== 'loading'}
                        onFinish={() => setSplashGone(true)}
                    />
                )}
            </PersistQueryClientProvider>
        </GestureHandlerRootView>
    );
}
