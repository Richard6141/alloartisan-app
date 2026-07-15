import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ShieldCheck, X } from 'lucide-react-native';
import { ApiError } from '../lib/api';
import {
    usePayerAbonnement,
    useVerifierPaiementAbonnement,
    type PlanPayant,
} from '../features/artisan/hooks';
import { colors, spacing, typography, fontSizes, radii } from '../theme/tokens';

/**
 * Paiement d'un abonnement (checkout FedaPay) — écran PLEIN, pas un Modal.
 *
 * Pourquoi un écran et pas un Modal ? Sur Android, un Modal RN crée une
 * fenêtre native séparée qui ignore softwareKeyboardLayoutMode:"resize" :
 * la WebView ne se redimensionne pas quand le clavier s'ouvre, l'input du
 * numéro passe sous le clavier et une couche grise apparaît. Un écran normal
 * respecte le resize : la page FedaPay reflue proprement, tout reste visible.
 */

/** Marqueur de retour passé en callback_url par le serveur */
const MARQUEUR_RETOUR = 'paiement.alloartisan.retour';

export default function PaiementAbonnementScreen() {
    const router = useRouter();
    const { plan } = useLocalSearchParams<{ plan: PlanPayant }>();
    const payer = usePayerAbonnement();
    const verifier = useVerifierPaiementAbonnement();

    const [url, setUrl] = useState<string | null>(null);
    const [paiementId, setPaiementId] = useState<string | null>(null);
    const [aNavigue, setANavigue] = useState(false);
    const lance = useRef(false);
    const dejaVerifie = useRef(false);

    // Créer l'intention de paiement une seule fois puis charger le checkout
    useEffect(() => {
        if (lance.current || !plan) return;
        lance.current = true;
        payer.mutate(
            { plan },
            {
                onSuccess: (res) => {
                    setPaiementId(res.paiementId);
                    setUrl(res.paymentUrl);
                },
                onError: (e) => {
                    Alert.alert(
                        'Paiement impossible',
                        e instanceof ApiError ? e.message : 'Réessayez.',
                        [{ text: 'OK', onPress: () => router.back() }],
                    );
                },
            },
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plan]);

    /** Vérifie la transaction auprès du serveur, active le palier, revient */
    const verifierPaiement = () => {
        if (!paiementId || dejaVerifie.current) return;
        dejaVerifie.current = true;
        verifier.mutate(paiementId, {
            onSuccess: (res) => {
                if (res.statut === 'COMPLETEE') {
                    router.back();
                    Alert.alert(
                        `Palier ${res.plan} activé 🎉`,
                        'Votre paiement est confirmé. Bon business !',
                    );
                } else if (res.statut === 'ECHOUEE') {
                    dejaVerifie.current = false;
                    Alert.alert('Paiement non abouti', 'Le paiement a été refusé ou annulé.', [
                        { text: 'OK', onPress: () => router.back() },
                    ]);
                } else {
                    // Encore en attente : laisser l'utilisateur revérifier
                    dejaVerifie.current = false;
                    Alert.alert(
                        'Paiement en cours de confirmation',
                        'FedaPay confirme votre paiement. Patientez quelques secondes puis touchez « J\'ai payé ».',
                    );
                }
            },
            onError: (e) => {
                dejaVerifie.current = false;
                Alert.alert(
                    'Vérification impossible',
                    e instanceof ApiError ? e.message : 'Vérifiez votre connexion.',
                );
            },
        });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <ShieldCheck size={17} color={colors.primary} strokeWidth={2.2} />
                <Text style={styles.title} numberOfLines={1}>
                    Paiement sécurisé · FedaPay
                </Text>
                {aNavigue && !verifier.isPending && (
                    <Pressable
                        onPress={verifierPaiement}
                        style={styles.doneChip}
                        accessibilityRole="button"
                        accessibilityLabel="J'ai payé, vérifier"
                    >
                        <Text style={styles.doneChipText}>J'ai payé</Text>
                    </Pressable>
                )}
                <Pressable
                    onPress={() => router.back()}
                    hitSlop={10}
                    style={styles.close}
                    accessibilityRole="button"
                    accessibilityLabel="Fermer le paiement"
                >
                    <X size={20} color={colors.text} strokeWidth={2.2} />
                </Pressable>
            </View>

            {url ? (
                <WebView
                    source={{ uri: url }}
                    onNavigationStateChange={(nav) => {
                        if (nav.url && !nav.url.includes(MARQUEUR_RETOUR)) setANavigue(true);
                    }}
                    onShouldStartLoadWithRequest={(request) => {
                        // FedaPay redirige vers le marqueur en fin de checkout
                        if (request.url.includes(MARQUEUR_RETOUR)) {
                            verifierPaiement();
                            return false;
                        }
                        return true;
                    }}
                    javaScriptEnabled
                    domStorageEnabled
                    setSupportMultipleWindows={false}
                    style={{ flex: 1, backgroundColor: colors.background }}
                />
            ) : (
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Préparation du paiement sécurisé…</Text>
                </View>
            )}

            {verifier.isPending && (
                <View style={styles.verifOverlay} pointerEvents="none">
                    <View style={styles.verifBox}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.verifText}>Vérification du paiement…</Text>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
    },
    title: {
        flex: 1,
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.base,
        color: colors.text,
    },
    doneChip: {
        backgroundColor: colors.primary,
        borderRadius: radii.full,
        paddingHorizontal: spacing.md,
        height: 32,
        justifyContent: 'center',
    },
    doneChipText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
        color: colors.onPrimary,
    },
    close: {
        width: 34,
        height: 34,
        borderRadius: radii.full,
        backgroundColor: colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
    },
    loadingText: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    verifOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15,23,42,0.35)',
    },
    verifBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    verifText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
});
