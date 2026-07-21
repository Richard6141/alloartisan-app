import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { BellRing, BatteryCharging } from 'lucide-react-native';
import { useAuth } from '../stores/auth';
import { prefsStorage } from '../lib/storage';
import { requestBatteryExemption, isTranssionBrand } from '../lib/backgroundReception';
import { Button } from './ui';
import { colors, spacing, typography, fontSizes, radii } from '../theme/tokens';

/**
 * Invite « recevoir les notifications app fermée » — proposée UNE seule fois,
 * après connexion, sur Android. Sur les surcouches agressives (Tecno/Infinix/
 * iTel…), l'OS coupe la remise FCM tant que l'app n'est pas autorisée à tourner
 * en arrière-plan. On propose donc l'exemption d'optimisation batterie (dialogue
 * système, 1 tap) et un renvoi vers les étapes détaillées (auto-démarrage).
 *
 * Rendu au niveau racine (comme RealtimeBridge). No-op hors Android.
 */
export function BackgroundReceptionPrompt() {
    const router = useRouter();
    const status = useAuth((s) => s.status);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (Platform.OS !== 'android' || status !== 'authenticated') return;
        let cancelled = false;
        const t = setTimeout(() => {
            void prefsStorage.hasSeenBackgroundPrompt().then((seen) => {
                if (!seen && !cancelled) setVisible(true);
            });
        }, 1800); // laisser l'app se poser (splash/verrou) avant d'afficher
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [status]);

    const close = () => {
        void prefsStorage.markBackgroundPromptSeen();
        setVisible(false);
    };

    const allow = () => {
        void requestBatteryExemption();
        close();
    };

    const seeSteps = () => {
        close();
        router.push('/reception-arriere-plan');
    };

    const transsion = isTranssionBrand();

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
            <View style={styles.scrim}>
                <View style={styles.card}>
                    <View style={styles.iconWrap}>
                        <BellRing size={26} color={colors.primary} strokeWidth={2.2} />
                    </View>
                    <Text style={styles.title}>Ne manquez aucune notification</Text>
                    <Text style={styles.body}>
                        {transsion
                            ? 'Votre téléphone met les applications en veille et bloque les notifications quand AlloArtisan est fermée. Autorisez-la à fonctionner en arrière-plan pour recevoir messages et réservations à temps — comme WhatsApp.'
                            : 'Pour recevoir vos messages et réservations même lorsque l’application est fermée, autorisez AlloArtisan à fonctionner en arrière-plan.'}
                    </Text>

                    <View style={styles.hint}>
                        <BatteryCharging size={16} color={colors.textSecondary} strokeWidth={2} />
                        <Text style={styles.hintText}>
                            Appuyez sur « Autoriser », puis choisissez « Autoriser » /
                            « Sans restriction » dans la fenêtre du système.
                        </Text>
                    </View>

                    <Button
                        title="Autoriser"
                        size="lg"
                        fullWidth
                        onPress={allow}
                        style={{ marginTop: spacing.md }}
                    />
                    <Button
                        title={transsion ? 'Voir les étapes (Tecno/Infinix/iTel)' : 'Voir les étapes détaillées'}
                        variant="ghost"
                        size="md"
                        fullWidth
                        onPress={seeSteps}
                    />
                    <Pressable
                        onPress={close}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Plus tard"
                    >
                        <Text style={styles.later}>Plus tard</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    scrim: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: radii.xl,
        padding: spacing.xl,
        gap: spacing.xs,
    },
    iconWrap: {
        width: 52,
        height: 52,
        borderRadius: radii.full,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xs,
    },
    title: {
        fontFamily: typography.heading,
        fontSize: fontSizes.lg,
        color: colors.text,
        letterSpacing: -0.3,
    },
    body: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        lineHeight: 21,
        marginTop: spacing.xs,
    },
    hint: {
        flexDirection: 'row',
        gap: spacing.sm,
        alignItems: 'flex-start',
        backgroundColor: colors.surfaceMuted,
        borderRadius: radii.lg,
        padding: spacing.md,
        marginTop: spacing.md,
    },
    hintText: {
        flex: 1,
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        lineHeight: 17,
    },
    later: {
        textAlign: 'center',
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.textMuted,
        paddingVertical: spacing.sm,
    },
});
