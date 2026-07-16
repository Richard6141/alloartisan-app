import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Animated, Easing } from 'react-native';
import { AnimatedBrandLogo } from './BrandLogo';

/** Fond identique au splash natif (app.json → expo-splash-screen backgroundColor) */
const SPLASH_BG = '#1E3A8A';

/**
 * Écran de démarrage animé : reprend le splash natif sans coupure (même fond),
 * joue l'animation du logo (le « A » se pose, le pinceau se peint, le nom monte)
 * pendant que l'app s'hydrate, puis disparaît en FONDU — plus d'arrivée brutale.
 *
 * Le fondu ne part que lorsque l'animation du logo est finie ET que l'app est
 * prête (`appReady`) : si l'hydratation traîne, on tient la dernière image du
 * logo ; si elle est instantanée, on laisse quand même l'animation se jouer.
 */
export function AnimatedSplash({
    appReady,
    onFinish,
}: {
    appReady: boolean;
    onFinish: () => void;
}) {
    const [animDone, setAnimDone] = useState(false);
    const fade = useRef(new Animated.Value(1)).current;
    const started = useRef(false);

    useEffect(() => {
        if (animDone && appReady && !started.current) {
            started.current = true;
            Animated.timing(fade, {
                toValue: 0,
                duration: 420,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }).start(() => onFinish());
        }
    }, [animDone, appReady, fade, onFinish]);

    return (
        <Animated.View style={[styles.container, { opacity: fade }]}>
            <AnimatedBrandLogo
                mono
                tagline
                layout="column"
                size={76}
                onDone={() => setAnimDone(true)}
            />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: SPLASH_BG,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
    },
});
