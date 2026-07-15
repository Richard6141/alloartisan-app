import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path, Rect, ClipPath, Defs, G } from 'react-native-svg';
import { palette, colors, spacing, typography, fontSizes } from '../theme/tokens';

/**
 * Logo AlloArtisan — concept « A Geste » :
 * un « A » plein et géométrique navy, balayé d'un COUP DE PINCEAU ocre effilé
 * (fin aux extrémités, épais au centre) qui évoque le savoir-faire et la
 * fierté du travail bien fait. 100 % vectoriel (SVG), net à toute taille.
 */

// « A » plein (contour + fenêtre triangulaire), règle evenodd
const A_PATH =
    'M50 12 L90 90 L72 90 L64 70 L36 70 L28 90 L10 90 Z M50 44 L60 64 L40 64 Z';
// Coup de pinceau : swoosh effilé qui BARRE le A en diagonale et remonte à
// droite (posé PAR-DESSUS le A, comme dans la maquette)
const BRUSH_PATH =
    'M18 68 C 34 62, 54 62, 70 55 C 78 52, 85 47, 90 41 C 86 50, 80 59, 71 64 C 56 72, 36 74, 18 72 Z';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface MarkProps {
    size?: number;
    /** true = tout blanc (sur fond sombre) */
    mono?: boolean;
}

/** Symbole seul (« A » + coup de pinceau), statique */
export function BrandMark({ size = 48, mono = false }: MarkProps) {
    const navy = mono ? palette.white : palette.navy900;
    const brush = mono ? palette.white : palette.terracotta500;
    return (
        <Svg width={size} height={size} viewBox="0 0 100 100">
            <Path d={A_PATH} fill={navy} fillRule="evenodd" />
            <Path d={BRUSH_PATH} fill={brush} opacity={mono ? 0.9 : 1} />
        </Svg>
    );
}

interface LogoProps extends MarkProps {
    /** Afficher la signature sous le nom */
    tagline?: boolean;
    /** Disposition : symbole à gauche du nom (row) ou au-dessus (column) */
    layout?: 'row' | 'column';
}

function Wordmark({ mono, tagline }: { mono: boolean; tagline: boolean }) {
    return (
        <>
            <Text style={styles.word}>
                <Text style={{ color: mono ? palette.white : palette.navy900 }}>Allo</Text>
                <Text style={{ color: mono ? palette.white : palette.terracotta600 }}>
                    Artisan
                </Text>
            </Text>
            {tagline && (
                <Text
                    style={[
                        styles.tagline,
                        { color: mono ? 'rgba(255,255,255,0.75)' : colors.textSecondary },
                    ]}
                >
                    Savoir-faire à la demande
                </Text>
            )}
        </>
    );
}

/** Logo complet : symbole + « AlloArtisan » + signature, statique */
export function BrandLogo({
    size = 40,
    mono = false,
    tagline = true,
    layout = 'row',
}: LogoProps) {
    return (
        <View style={layout === 'row' ? styles.row : styles.column}>
            <BrandMark size={size} mono={mono} />
            <View style={layout === 'column' ? styles.wordCenter : undefined}>
                <Wordmark mono={mono} tagline={tagline} />
            </View>
        </View>
    );
}

interface AnimatedProps extends LogoProps {
    onDone?: () => void;
}

/**
 * Logo animé : le « A » se pose (fondu + zoom), le coup de pinceau SE PEINT
 * (révélé de gauche à droite via un masque animé — effet coup de pinceau),
 * puis le nom monte en fondu. Transform/opacité + masque → stable en Expo Go.
 */
export function AnimatedBrandLogo({
    size = 56,
    mono = false,
    tagline = true,
    layout = 'column',
    onDone,
}: AnimatedProps) {
    const navy = mono ? palette.white : palette.navy900;
    const brush = mono ? palette.white : palette.terracotta500;

    const aScale = useRef(new Animated.Value(0.7)).current;
    const aOpacity = useRef(new Animated.Value(0)).current;
    const brushReveal = useRef(new Animated.Value(0)).current; // largeur du masque 0 → 100
    const wordOpacity = useRef(new Animated.Value(0)).current;
    const wordShift = useRef(new Animated.Value(10)).current;

    useEffect(() => {
        Animated.sequence([
            // 1. Le « A » se pose
            Animated.parallel([
                Animated.timing(aOpacity, {
                    toValue: 1,
                    duration: 360,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.spring(aScale, {
                    toValue: 1,
                    friction: 6,
                    tension: 60,
                    useNativeDriver: true,
                }),
            ]),
            // 2. Le coup de pinceau se peint (masque révélé, driver JS)
            Animated.timing(brushReveal, {
                toValue: 100,
                duration: 560,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false,
            }),
            // 3. Le nom + signature montent
            Animated.parallel([
                Animated.timing(wordOpacity, {
                    toValue: 1,
                    duration: 320,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(wordShift, {
                    toValue: 0,
                    duration: 320,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]),
        ]).start(({ finished }) => {
            if (finished) onDone?.();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <View style={layout === 'row' ? styles.row : styles.column}>
            <Animated.View style={{ opacity: aOpacity, transform: [{ scale: aScale }] }}>
                <Svg width={size} height={size} viewBox="0 0 100 100">
                    <Defs>
                        <ClipPath id="brushReveal">
                            <AnimatedRect x={0} y={0} height={100} width={brushReveal} />
                        </ClipPath>
                    </Defs>
                    {/* Le A d'abord, le pinceau PAR-DESSUS (révélé de gauche à droite) */}
                    <Path d={A_PATH} fill={navy} fillRule="evenodd" />
                    <G clipPath="url(#brushReveal)">
                        <Path d={BRUSH_PATH} fill={brush} opacity={mono ? 0.9 : 1} />
                    </G>
                </Svg>
            </Animated.View>

            <Animated.View
                style={[
                    layout === 'column' ? styles.wordCenter : undefined,
                    { opacity: wordOpacity, transform: [{ translateY: wordShift }] },
                ]}
            >
                <Wordmark mono={mono} tagline={tagline} />
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    column: {
        alignItems: 'center',
        gap: spacing.md,
    },
    wordCenter: {
        alignItems: 'center',
    },
    word: {
        fontFamily: typography.heading,
        fontSize: fontSizes['2xl'],
        letterSpacing: -0.6,
    },
    tagline: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        marginTop: 1,
    },
});
