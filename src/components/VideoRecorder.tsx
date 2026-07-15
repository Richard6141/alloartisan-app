import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { X, SwitchCamera, Square } from 'lucide-react-native';
import { colors, spacing, typography, fontSizes, radii } from '../theme/tokens';

const MAX_DURATION_S = 30;

/**
 * Caméra vidéo INTÉGRÉE au chat (remplace la caméra système) :
 * - filme directement en 720p → 12 s ≈ 3-6 Mo au lieu de 50-70 Mo en 4K,
 *   l'envoi passe partout, même en données mobiles
 * - 30 s max avec arrêt automatique, minuteur visible
 * - bonus : l'app ne passe pas en arrière-plan, donc jamais de conflit
 *   avec le verrou par empreinte
 */
export function VideoRecorder({
    visible,
    onClose,
    onRecorded,
}: {
    visible: boolean;
    onClose: () => void;
    onRecorded: (uri: string, durationSec: number) => void;
}) {
    const cameraRef = useRef<CameraView>(null);
    const [camPerm, requestCamPerm] = useCameraPermissions();
    const [micPerm, requestMicPerm] = useMicrophonePermissions();
    const [facing, setFacing] = useState<'back' | 'front'>('back');
    const [recording, setRecording] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);
    const startedAt = useRef(0);

    // Demander caméra + micro à l'ouverture
    useEffect(() => {
        if (!visible) return;
        void (async () => {
            if (!camPerm?.granted) await requestCamPerm();
            if (!micPerm?.granted) await requestMicPerm();
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const cleanupTimer = () => {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
    };

    const startRecording = async () => {
        const camera = cameraRef.current;
        if (!camera || recording) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setRecording(true);
        setSeconds(0);
        startedAt.current = Date.now();
        timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);

        try {
            // recordAsync se résout à l'arrêt (manuel ou maxDuration atteint)
            const video = await camera.recordAsync({ maxDuration: MAX_DURATION_S });
            const durationSec = Math.max(
                1,
                Math.round((Date.now() - startedAt.current) / 1000),
            );
            cleanupTimer();
            setRecording(false);
            if (video?.uri) {
                onRecorded(video.uri, Math.min(durationSec, MAX_DURATION_S));
            }
            onClose();
        } catch {
            cleanupTimer();
            setRecording(false);
        }
    };

    const stopRecording = () => {
        cameraRef.current?.stopRecording();
    };

    const close = () => {
        if (recording) stopRecording();
        cleanupTimer();
        setRecording(false);
        onClose();
    };

    const permissionsOk = camPerm?.granted && micPerm?.granted;

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={close}>
            <View style={styles.container}>
                {permissionsOk ? (
                    <CameraView
                        ref={cameraRef}
                        style={StyleSheet.absoluteFill}
                        facing={facing}
                        mode="video"
                        videoQuality="720p"
                    />
                ) : (
                    <View style={styles.permissionBox}>
                        <Text style={styles.permissionText}>
                            Autorisez la caméra et le micro pour filmer.
                        </Text>
                    </View>
                )}

                {/* Minuteur */}
                {recording && (
                    <View style={styles.timerPill}>
                        <View style={styles.recDot} />
                        <Text style={styles.timerText}>
                            0:{String(seconds).padStart(2, '0')} / 0:{MAX_DURATION_S}
                        </Text>
                    </View>
                )}

                {/* Fermer */}
                <Pressable
                    onPress={close}
                    style={styles.closeButton}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Fermer la caméra"
                >
                    <X size={22} color="#FFFFFF" strokeWidth={2.2} />
                </Pressable>

                {/* Commandes du bas */}
                <View style={styles.controls}>
                    <View style={{ width: 48 }} />
                    <Pressable
                        onPress={recording ? stopRecording : startRecording}
                        accessibilityRole="button"
                        accessibilityLabel={
                            recording ? 'Arrêter et envoyer' : 'Commencer à filmer'
                        }
                        style={[styles.recordButton, recording && styles.recordButtonActive]}
                    >
                        {recording ? (
                            <Square size={24} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
                        ) : (
                            <View style={styles.recordInner} />
                        )}
                    </Pressable>
                    <Pressable
                        onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
                        disabled={recording}
                        style={[styles.flipButton, recording && { opacity: 0.4 }]}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Changer de caméra"
                    >
                        <SwitchCamera size={22} color="#FFFFFF" strokeWidth={2} />
                    </Pressable>
                </View>

                {!recording && permissionsOk && (
                    <Text style={styles.hint}>
                        Filmez la panne (30 s max). La vidéo est compressée automatiquement.
                    </Text>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    permissionBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing['3xl'],
    },
    permissionText: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.base,
        color: '#FFFFFF',
        textAlign: 'center',
    },
    timerPill: {
        position: 'absolute',
        top: 56,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: radii.full,
        paddingHorizontal: spacing.md,
        paddingVertical: 5,
    },
    recDot: {
        width: 9,
        height: 9,
        borderRadius: radii.full,
        backgroundColor: '#EF4444',
    },
    timerText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: '#FFFFFF',
        fontVariant: ['tabular-nums'],
    },
    closeButton: {
        position: 'absolute',
        top: 52,
        right: 20,
        width: 40,
        height: 40,
        borderRadius: radii.full,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    controls: {
        position: 'absolute',
        bottom: 48,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-evenly',
    },
    recordButton: {
        width: 76,
        height: 76,
        borderRadius: radii.full,
        borderWidth: 4,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    recordButtonActive: {
        backgroundColor: '#EF4444',
        borderColor: '#FFFFFF',
    },
    recordInner: {
        width: 56,
        height: 56,
        borderRadius: radii.full,
        backgroundColor: '#EF4444',
    },
    flipButton: {
        width: 48,
        height: 48,
        borderRadius: radii.full,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    hint: {
        position: 'absolute',
        bottom: 16,
        alignSelf: 'center',
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: 'rgba(255,255,255,0.75)',
    },
});
