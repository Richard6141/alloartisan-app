import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft,
    ChevronDown,
    MessageCircle,
    Mail,
    Phone,
} from 'lucide-react-native';
import { Card } from '../components/ui';
import { suppressLock } from '../lib/lockGuard';
import { colors, spacing, typography, fontSizes, lineHeights, radii } from '../theme/tokens';

const FAQ: { q: string; a: string }[] = [
    {
        q: 'Comment réserver un artisan ?',
        a: "Cherchez un artisan (loupe au centre), ouvrez son profil, touchez « Réserver » et décrivez votre besoin. L'artisan vous répond en général sous quelques heures avec un devis.",
    },
    {
        q: 'Quand est-ce que je paie ?',
        a: "Après avoir accepté le devis de l'artisan. Vous payez par Mobile Money (MTN, Moov), carte bancaire, ou en espèces après les travaux. Votre paiement est sécurisé et vous recevez un reçu.",
    },
    {
        q: 'Comment suivre mon artisan le jour J ?',
        a: 'Dès que votre rendez-vous est confirmé, un bouton « Suivre en direct » apparaît sur votre réservation : vous voyez l\'artisan arriver sur la carte avec son heure d\'arrivée estimée, comme un taxi.',
    },
    {
        q: 'Les artisans sont-ils vérifiés ?',
        a: 'Oui. Chaque profil artisan est vérifié par notre équipe avant d\'être visible (badge bleu ✓). Et seuls les clients ayant réellement terminé une intervention peuvent laisser un avis.',
    },
    {
        q: 'Comment fonctionne le parrainage ?',
        a: 'Partagez votre code (onglet Profil) : votre filleul gagne 500 F sur sa première intervention payée, et vous gagnez 1 000 F. Vos codes gagnés sont dans « Mes récompenses ».',
    },
    {
        q: 'Que faire en cas de problème avec un artisan ?',
        a: "Contactez-nous via WhatsApp ou email (boutons ci-dessous) avec le numéro de votre réservation. Notre équipe traite les litiges sous 48 h.",
    },
    {
        q: 'Comment annuler une réservation ?',
        a: 'Ouvrez la réservation et touchez « Annuler la demande ». C\'est gratuit tant que le rendez-vous n\'est pas confirmé.',
    },
];

/** Aide & support : FAQ dépliable + canaux de contact */
export default function AideScreen() {
    const router = useRouter();

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
                <Text style={styles.title}>Aide & support</Text>
                <View style={{ width: 38 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.sectionLabel}>Questions fréquentes</Text>
                <View style={{ gap: spacing.sm }}>
                    {FAQ.map((item) => (
                        <FaqItem key={item.q} question={item.q} answer={item.a} />
                    ))}
                </View>

                <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>
                    Nous contacter
                </Text>
                <View style={{ gap: spacing.sm }}>
                    <ContactRow
                        icon={<MessageCircle size={19} color="#15803D" strokeWidth={2} />}
                        bg="#DCFCE7"
                        label="WhatsApp"
                        detail="Réponse rapide, 7j/7"
                        onPress={() => {
                            suppressLock();
                            void Linking.openURL('https://wa.me/22990000000');
                        }}
                    />
                    <ContactRow
                        icon={<Mail size={19} color={colors.primary} strokeWidth={2} />}
                        bg={colors.primarySoft}
                        label="Email"
                        detail="support@alloartisan.bj"
                        onPress={() => {
                            suppressLock();
                            void Linking.openURL('mailto:support@alloartisan.bj');
                        }}
                    />
                    <ContactRow
                        icon={<Phone size={19} color="#B45309" strokeWidth={2} />}
                        bg="#FEF3C7"
                        label="Téléphone"
                        detail="Lun–Sam, 8h–19h"
                        onPress={() => {
                            suppressLock();
                            void Linking.openURL('tel:+22990000000');
                        }}
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
    const [open, setOpen] = useState(false);
    return (
        <Pressable
            onPress={() => setOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
        >
            <Card style={{ gap: open ? spacing.sm : 0 }}>
                <View style={styles.faqHeader}>
                    <Text style={styles.faqQuestion}>{question}</Text>
                    <ChevronDown
                        size={17}
                        color={colors.textSecondary}
                        strokeWidth={2}
                        style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
                    />
                </View>
                {open && <Text style={styles.faqAnswer}>{answer}</Text>}
            </Card>
        </Pressable>
    );
}

function ContactRow({
    icon,
    bg,
    label,
    detail,
    onPress,
}: {
    icon: React.ReactNode;
    bg: string;
    label: string;
    detail: string;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${label} : ${detail}`}
            style={({ pressed }) => [pressed && { opacity: 0.85 }]}
        >
            <Card style={styles.contactRow}>
                <View style={[styles.contactIcon, { backgroundColor: bg }]}>{icon}</View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.contactLabel}>{label}</Text>
                    <Text style={styles.contactDetail}>{detail}</Text>
                </View>
            </Card>
        </Pressable>
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
    },
    sectionLabel: {
        fontFamily: typography.heading,
        fontSize: fontSizes.base,
        color: colors.text,
        marginBottom: spacing.md,
    },
    faqHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
    },
    faqQuestion: {
        flex: 1,
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    faqAnswer: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        lineHeight: lineHeights.sm + 4,
        color: colors.textSecondary,
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    contactIcon: {
        width: 42,
        height: 42,
        borderRadius: radii.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    contactLabel: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.base,
        color: colors.text,
    },
    contactDetail: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: 1,
    },
});
