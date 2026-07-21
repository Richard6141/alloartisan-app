import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, BatteryCharging, Settings2, BellRing, CheckCircle2 } from 'lucide-react-native';
import {
    requestBatteryExemption,
    openAppSettings,
    getBrandGuide,
    isTranssionBrand,
} from '../lib/backgroundReception';
import { Button, Card } from '../components/ui';
import { colors, spacing, typography, fontSizes, radii } from '../theme/tokens';

/**
 * Aide « recevoir les notifications app fermée ». Explique le réglage batterie
 * (déclenchable en 1 tap) + l'auto-démarrage (propriétaire → guidé pas à pas,
 * avec un bouton qui ouvre la fiche de l'app). Accessible depuis Paramètres et
 * depuis l'invite post-connexion.
 */
export default function ReceptionArrierePlanScreen() {
    const router = useRouter();
    const guide = getBrandGuide();
    const isAndroid = Platform.OS === 'android';

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.topBar}>
                <Pressable
                    onPress={() => router.back()}
                    hitSlop={12}
                    style={styles.backButton}
                    accessibilityRole="button"
                    accessibilityLabel="Retour"
                >
                    <ArrowLeft size={20} color={colors.text} strokeWidth={2.2} />
                </Pressable>
                <Text style={styles.title}>Notifications en arrière-plan</Text>
                <View style={{ width: 38 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.heroIcon}>
                    <BellRing size={26} color={colors.primary} strokeWidth={2.2} />
                </View>
                <Text style={styles.lead}>
                    {isTranssionBrand()
                        ? 'Votre téléphone (Tecno / Infinix / iTel) met les apps en veille et bloque leurs notifications une fois fermées. Deux réglages suffisent pour recevoir messages et réservations à temps.'
                        : 'Pour recevoir vos messages et réservations même application fermée, autorisez AlloArtisan à fonctionner en arrière-plan.'}
                </Text>

                {!isAndroid && (
                    <Card style={styles.iosCard}>
                        <Text style={styles.iosText}>
                            Sur iPhone, les notifications fonctionnent sans réglage particulier.
                        </Text>
                    </Card>
                )}

                {isAndroid && (
                    <>
                        {/* Étape 1 : exemption batterie (1 tap) */}
                        <Text style={styles.stepLabel}>1. Autoriser l’arrière-plan</Text>
                        <Card style={styles.actionCard}>
                            <BatteryCharging size={20} color={colors.primary} strokeWidth={2} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.actionTitle}>Exemption d’optimisation batterie</Text>
                                <Text style={styles.actionText}>
                                    Ouvre la fenêtre du système. Choisissez « Autoriser » /
                                    « Sans restriction ».
                                </Text>
                            </View>
                        </Card>
                        <Button
                            title="Autoriser l’arrière-plan"
                            size="lg"
                            fullWidth
                            onPress={() => void requestBatteryExemption()}
                        />

                        {/* Étape 2 : auto-démarrage (guidé) */}
                        <Text style={styles.stepLabel}>2. Activer le démarrage automatique</Text>
                        <Card style={styles.guideCard}>
                            <Text style={styles.guideBrand}>{guide.label}</Text>
                            {guide.steps.map((step, i) => (
                                <View key={i} style={styles.stepRow}>
                                    <CheckCircle2
                                        size={16}
                                        color={colors.success}
                                        strokeWidth={2}
                                        style={{ marginTop: 1 }}
                                    />
                                    <Text style={styles.stepText}>{step}</Text>
                                </View>
                            ))}
                        </Card>
                        <Button
                            title="Ouvrir les réglages de l’app"
                            variant="secondary"
                            size="md"
                            fullWidth
                            icon={<Settings2 size={17} color={colors.primary} strokeWidth={2} />}
                            onPress={() => void openAppSettings()}
                        />

                        <Text style={styles.footNote}>
                            Astuce : dans les applications récentes, appui long sur AlloArtisan puis
                            le cadenas 🔒 empêche le téléphone de la fermer.
                        </Text>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
    },
    backButton: {
        width: 38,
        height: 38,
        borderRadius: radii.full,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    title: {
        flex: 1,
        textAlign: 'center',
        fontFamily: typography.heading,
        fontSize: fontSizes.lg,
        color: colors.text,
        letterSpacing: -0.3,
    },
    content: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing['4xl'],
        gap: spacing.md,
    },
    heroIcon: {
        width: 52,
        height: 52,
        borderRadius: radii.full,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginTop: spacing.sm,
    },
    lead: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        lineHeight: 21,
        textAlign: 'center',
    },
    iosCard: { marginTop: spacing.sm },
    iosText: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    stepLabel: {
        fontFamily: typography.heading,
        fontSize: fontSizes.base,
        color: colors.text,
        marginTop: spacing.md,
    },
    actionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    actionTitle: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.base,
        color: colors.text,
    },
    actionText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: 1,
        lineHeight: 16,
    },
    guideCard: { gap: spacing.sm },
    guideBrand: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.primary,
        marginBottom: spacing.xs,
    },
    stepRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        alignItems: 'flex-start',
    },
    stepText: {
        flex: 1,
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        lineHeight: 19,
    },
    footNote: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        lineHeight: 17,
        marginTop: spacing.md,
    },
});
