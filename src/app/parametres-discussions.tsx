import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
    ArrowLeft,
    CloudDownload,
    Type,
    Vibrate,
    Trash2,
    ShieldCheck,
} from 'lucide-react-native';
import { useChatPrefs, TextScale } from '../stores/chatPrefs';
import { Card, Button } from '../components/ui';
import { colors, spacing, typography, fontSizes, lineHeights, radii } from '../theme/tokens';

/** Paramètres des discussions, façon WhatsApp (stockés sur le téléphone) */
export default function ParametresDiscussionsScreen() {
    const router = useRouter();
    const prefs = useChatPrefs();
    const [clearing, setClearing] = useState(false);

    useEffect(() => {
        if (!prefs.hydrated) void prefs.hydrate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const clearMediaCache = async () => {
        setClearing(true);
        try {
            await Image.clearDiskCache();
            await Image.clearMemoryCache();
            Alert.alert(
                'Cache vidé ✅',
                'Les photos et vidéos en cache ont été supprimées de ce téléphone. Elles se retéléchargeront à la demande.',
            );
        } catch {
            Alert.alert('Erreur', 'Impossible de vider le cache.');
        } finally {
            setClearing(false);
        }
    };

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
                <Text style={styles.title}>Discussions</Text>
                <View style={{ width: 38 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Données */}
                <Text style={styles.sectionLabel}>Données et médias</Text>
                <Card style={styles.row}>
                    <CloudDownload size={20} color={colors.primary} strokeWidth={2} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>Téléchargement automatique</Text>
                        <Text style={styles.rowText}>
                            Photos et vidéos s'affichent directement. Désactivez pour économiser
                            vos données : elles se chargeront au toucher.
                        </Text>
                    </View>
                    <Switch
                        value={prefs.autoDownloadMedia}
                        onValueChange={(v) => prefs.setPref('autoDownloadMedia', v)}
                        trackColor={{ true: colors.primary, false: colors.border }}
                        thumbColor={colors.surface}
                    />
                </Card>

                <Card style={styles.row}>
                    <Trash2 size={20} color={colors.textSecondary} strokeWidth={2} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>Vider le cache des médias</Text>
                        <Text style={styles.rowText}>
                            Libère de l'espace sur ce téléphone (les médias restent disponibles
                            en ligne)
                        </Text>
                    </View>
                    <Button
                        title="Vider"
                        variant="secondary"
                        size="sm"
                        loading={clearing}
                        onPress={() => void clearMediaCache()}
                    />
                </Card>

                {/* Affichage */}
                <Text style={styles.sectionLabel}>Affichage</Text>
                <Card style={{ gap: spacing.md }}>
                    <View style={styles.rowInline}>
                        <Type size={20} color={colors.primary} strokeWidth={2} />
                        <Text style={styles.rowTitle}>Taille du texte des messages</Text>
                    </View>
                    <View style={styles.segmentRow}>
                        {(['petit', 'normal', 'grand'] as TextScale[]).map((scale) => {
                            const selected = prefs.textScale === scale;
                            return (
                                <Pressable
                                    key={scale}
                                    onPress={() => prefs.setPref('textScale', scale)}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected }}
                                    style={[styles.segment, selected && styles.segmentOn]}
                                >
                                    <Text
                                        style={[
                                            styles.segmentText,
                                            selected && { color: colors.onPrimary },
                                            scale === 'petit' && { fontSize: fontSizes.xs },
                                            scale === 'grand' && { fontSize: fontSizes.md },
                                        ]}
                                    >
                                        Aa
                                    </Text>
                                    <Text
                                        style={[
                                            styles.segmentLabel,
                                            selected && { color: colors.onPrimary },
                                        ]}
                                    >
                                        {scale}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </Card>

                {/* Comportement */}
                <Text style={styles.sectionLabel}>Comportement</Text>
                <Card style={styles.row}>
                    <Vibrate size={20} color={colors.primary} strokeWidth={2} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>Vibrations</Text>
                        <Text style={styles.rowText}>
                            Retour haptique à la réception de messages et notifications
                        </Text>
                    </View>
                    <Switch
                        value={prefs.haptics}
                        onValueChange={(v) => prefs.setPref('haptics', v)}
                        trackColor={{ true: colors.primary, false: colors.border }}
                        thumbColor={colors.surface}
                    />
                </Card>

                {/* Note sécurité / stockage */}
                <View style={styles.note}>
                    <ShieldCheck size={15} color={colors.primary} strokeWidth={2} />
                    <Text style={styles.noteText}>
                        Vos médias sont hébergés sur un CDN sécurisé (jamais sur nos serveurs) et
                        mis en cache sur votre téléphone après la première lecture. Seuls les
                        participants d'une conversation peuvent y envoyer des fichiers, avec des
                        limites strictes de taille et de type.
                    </Text>
                </View>
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
    sectionLabel: {
        fontFamily: typography.heading,
        fontSize: fontSizes.base,
        color: colors.text,
        marginTop: spacing.sm,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    rowInline: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    rowTitle: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.base,
        color: colors.text,
    },
    rowText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 3,
        color: colors.textSecondary,
        marginTop: 1,
    },
    segmentRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    segment: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing.sm + 2,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        gap: 1,
    },
    segmentOn: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    segmentText: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    segmentLabel: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs - 1,
        color: colors.textSecondary,
        textTransform: 'capitalize',
    },
    note: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    noteText: {
        flex: 1,
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 4,
        color: colors.textMuted,
    },
});
