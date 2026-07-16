import React from 'react';
import { Modal, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { optimizedImage } from '../lib/image';
import { X } from 'lucide-react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

/**
 * Visionneuse d'image plein écran, fluide :
 * - pincer pour zoomer (jusqu'à ×4), glisser pour se déplacer
 * - double-tap : zoom ×2 / retour
 * - tout revient en place avec un ressort quand on relâche trop loin
 */
export function ImageViewer({
    uri,
    visible,
    onClose,
}: {
    uri: string | null;
    visible: boolean;
    onClose: () => void;
}) {
    const { width, height } = useWindowDimensions();
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const tx = useSharedValue(0);
    const ty = useSharedValue(0);
    const savedTx = useSharedValue(0);
    const savedTy = useSharedValue(0);

    const reset = () => {
        'worklet';
        scale.value = withSpring(1);
        savedScale.value = 1;
        tx.value = withSpring(0);
        ty.value = withSpring(0);
        savedTx.value = 0;
        savedTy.value = 0;
    };

    const pinch = Gesture.Pinch()
        .onUpdate((e) => {
            scale.value = Math.min(4, Math.max(1, savedScale.value * e.scale));
        })
        .onEnd(() => {
            savedScale.value = scale.value;
            if (scale.value <= 1.02) reset();
        });

    const pan = Gesture.Pan()
        .onUpdate((e) => {
            if (scale.value <= 1) return;
            tx.value = savedTx.value + e.translationX;
            ty.value = savedTy.value + e.translationY;
        })
        .onEnd(() => {
            // Limiter le déplacement à la zone zoomée
            const maxX = ((scale.value - 1) * width) / 2;
            const maxY = ((scale.value - 1) * height) / 2;
            tx.value = withSpring(Math.min(maxX, Math.max(-maxX, tx.value)));
            ty.value = withSpring(Math.min(maxY, Math.max(-maxY, ty.value)));
            savedTx.value = Math.min(maxX, Math.max(-maxX, tx.value));
            savedTy.value = Math.min(maxY, Math.max(-maxY, ty.value));
        });

    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
            if (scale.value > 1) {
                reset();
            } else {
                scale.value = withTiming(2, { duration: 180 });
                savedScale.value = 2;
            }
        });

    const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

    const imageStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: tx.value },
            { translateY: ty.value },
            { scale: scale.value },
        ],
    }));

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            {/* Un Modal Android crée une hiérarchie native SÉPARÉE : sans ce
                GestureHandlerRootView, pinch/pan/double-tap sont ignorés */}
            <GestureHandlerRootView style={{ flex: 1 }}>
            <GestureDetector gesture={composed}>
                <Animated.View style={styles.backdrop}>
                    {uri && (
                        <Animated.View style={[StyleSheet.absoluteFill, imageStyle]}>
                            <Image
                                source={{ uri: optimizedImage(uri, { width: 1080 }) }}
                                style={StyleSheet.absoluteFill}
                                contentFit="contain"
                                cachePolicy="memory-disk"
                                accessibilityLabel="Photo en plein écran"
                            />
                        </Animated.View>
                    )}
                    <Pressable
                        onPress={onClose}
                        style={styles.closeButton}
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel="Fermer"
                    >
                        <X size={22} color="#FFFFFF" strokeWidth={2.2} />
                    </Pressable>
                </Animated.View>
            </GestureDetector>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.96)',
    },
    closeButton: {
        position: 'absolute',
        top: 52,
        right: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
