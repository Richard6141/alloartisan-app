import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import { LoaderCircle } from 'lucide-react-native';

/**
 * Spinner animé en JavaScript (requestAnimationFrame, useNativeDriver: false).
 *
 * Pourquoi pas <ActivityIndicator> ? Sur beaucoup d'appareils Samsung, quand
 * l'échelle d'animation système est réduite/désactivée (réglage courant ou
 * accessibilité « Supprimer les animations »), l'ActivityIndicator natif
 * s'affiche mais NE TOURNE PLUS. Un Animated.loop piloté côté JS n'est pas
 * concerné par ce réglage et tourne toujours.
 */
export function Spinner({
    size = 18,
    color = '#FFFFFF',
    style,
}: {
    size?: number;
    color?: string;
    style?: StyleProp<ViewStyle>;
}) {
    const rotation = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.timing(rotation, {
                toValue: 1,
                duration: 750,
                easing: Easing.linear,
                useNativeDriver: false,
            }),
        );
        loop.start();
        return () => loop.stop();
    }, [rotation]);

    const rotate = rotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <Animated.View style={[{ transform: [{ rotate }] }, style]}>
            <LoaderCircle size={size} color={color} strokeWidth={2.6} />
        </Animated.View>
    );
}
