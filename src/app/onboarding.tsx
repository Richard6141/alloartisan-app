import React, { useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    useWindowDimensions,
    Pressable,
    type ViewToken,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, ShieldCheck, MessageCircle, Wrench } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Button } from '../components/ui';
import { useAuth } from '../stores/auth';
import {
    colors,
    palette,
    spacing,
    typography,
    fontSizes,
    lineHeights,
    radii,
} from '../theme/tokens';

interface Slide {
    key: string;
    Icon: LucideIcon;
    title: string;
    text: string;
    /** Dégradé du bloc illustration */
    gradient: [string, string];
    /** Pastille lumineuse derrière l'icône */
    glow: string;
}

const SLIDES: Slide[] = [
    {
        key: 'proche',
        Icon: MapPin,
        title: 'Le bon artisan,\ntout près de vous',
        text: 'Plombiers, électriciens, maçons, couturières… Trouvez en quelques secondes les pros disponibles autour de vous, du plus proche au plus loin.',
        gradient: [palette.navy700, palette.navy900],
        glow: 'rgba(96,165,250,0.45)',
    },
    {
        key: 'verifie',
        Icon: ShieldCheck,
        title: 'Des professionnels\nvérifiés',
        text: 'Identité et diplômes contrôlés par notre équipe. Les avis viennent uniquement de vraies interventions terminées. Vous choisissez en confiance.',
        gradient: ['#047857', '#065F46'],
        glow: 'rgba(52,211,153,0.45)',
    },
    {
        key: 'contact',
        Icon: MessageCircle,
        title: 'Contactez,\ndiscutez, convenez',
        text: 'Appel, messages, photos, position en direct : échangez librement avec l’artisan. Le prix se discute entre vous, sans intermédiaire. C’est gratuit pour vous.',
        gradient: [palette.terracotta600, palette.terracotta700],
        glow: 'rgba(251,191,36,0.45)',
    },
    {
        key: 'artisan',
        Icon: Wrench,
        title: 'Vous êtes\nartisan ?',
        text: 'Créez votre profil, faites-vous vérifier et recevez des demandes de clients proches de vous. Développez votre activité, à votre rythme.',
        gradient: [palette.navy800, '#312E81'],
        glow: 'rgba(129,140,248,0.45)',
    },
];

export default function OnboardingScreen() {
    const { width } = useWindowDimensions();
    const router = useRouter();
    const completeOnboarding = useAuth((s) => s.completeOnboarding);
    const [index, setIndex] = useState(0);
    const listRef = useRef<FlatList<Slide>>(null);

    const finish = async () => {
        await completeOnboarding();
        router.replace('/(tabs)');
    };

    const next = () => {
        if (index < SLIDES.length - 1) {
            listRef.current?.scrollToIndex({ index: index + 1, animated: true });
        } else {
            void finish();
        }
    };

    const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
    }).current;

    const dernier = index === SLIDES.length - 1;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.skipRow}>
                {!dernier && (
                    <Pressable onPress={finish} hitSlop={12} accessibilityRole="button">
                        <Text style={styles.skip}>Passer</Text>
                    </Pressable>
                )}
            </View>

            <FlatList
                ref={listRef}
                data={SLIDES}
                keyExtractor={(item) => item.key}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onViewableItemsChanged={onViewable}
                viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
                renderItem={({ item }) => (
                    <View style={[styles.slide, { width }]}>
                        <LinearGradient
                            colors={item.gradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.hero}
                        >
                            <View style={[styles.glow, { backgroundColor: item.glow }]} />
                            <View style={styles.iconBubble}>
                                <item.Icon size={52} color={palette.white} strokeWidth={1.7} />
                            </View>
                        </LinearGradient>
                        <View style={styles.textBlock}>
                            <Text style={styles.title}>{item.title}</Text>
                            <Text style={styles.text}>{item.text}</Text>
                        </View>
                    </View>
                )}
            />

            <View style={styles.footer}>
                <View style={styles.dots}>
                    {SLIDES.map((s, i) => (
                        <View
                            key={s.key}
                            style={[
                                styles.dot,
                                i === index && styles.dotActive,
                            ]}
                        />
                    ))}
                </View>
                <Button
                    title={dernier ? 'Commencer' : 'Suivant'}
                    size="lg"
                    fullWidth
                    onPress={next}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    skipRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: spacing.xl,
        height: 40,
        alignItems: 'center',
    },
    skip: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        padding: spacing.sm,
    },
    slide: {
        flex: 1,
        paddingHorizontal: spacing['2xl'],
        justifyContent: 'center',
        gap: spacing['3xl'],
    },
    hero: {
        height: 300,
        borderRadius: radii.xl + 8,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    glow: {
        position: 'absolute',
        width: 220,
        height: 220,
        borderRadius: radii.full,
        top: -40,
        right: -40,
    },
    iconBubble: {
        width: 112,
        height: 112,
        borderRadius: radii.full,
        backgroundColor: 'rgba(255,255,255,0.16)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
    },
    textBlock: {
        gap: spacing.md,
    },
    title: {
        fontFamily: typography.heading,
        fontSize: fontSizes['3xl'],
        lineHeight: lineHeights['3xl'],
        color: colors.text,
        letterSpacing: -0.6,
    },
    text: {
        fontFamily: typography.body,
        fontSize: fontSizes.md,
        lineHeight: lineHeights.md + 2,
        color: colors.textSecondary,
    },
    footer: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
        gap: spacing.xl,
    },
    dots: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.sm,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: radii.full,
        backgroundColor: colors.borderStrong,
    },
    dotActive: {
        width: 26,
        backgroundColor: colors.primary,
    },
});
