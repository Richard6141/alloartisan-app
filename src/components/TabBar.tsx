import React, { useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Home, Search, CalendarDays, MessageCircle, CircleUserRound } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
// SDK 57 : expo-router embarque sa propre copie de bottom-tabs (plus de
// dépendance @react-navigation directe) — import de type uniquement
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { useTabBadges } from '../features/badges/useTabBadges';
import { colors, palette, spacing, typography, fontSizes, radii, shadows } from '../theme/tokens';

const ICONS: Record<string, LucideIcon> = {
    index: Home,
    recherche: Search,
    reservations: CalendarDays,
    messages: MessageCircle,
    profil: CircleUserRound,
};

/** L'onglet central devient le bouton d'action flottant */
const CENTER_ROUTE = 'recherche';

const SPRING = { damping: 13, stiffness: 200 };

const INACTIVE_ICON = 'rgba(255,255,255,0.55)';

/**
 * Barre d'onglets sombre avec bouton central flottant (style marketplace) :
 * - Fond navy profond aux coins supérieurs arrondis
 * - Recherche = grand bouton circulaire dégradé qui flotte au-dessus de la
 *   barre, cerclé de blanc — l'action principale, sous le pouce
 * - Onglet actif : icône qui s'illumine en blanc + point lumineux + libellé
 *   en fondu (transforms/opacité uniquement — fiable sur SDK 57)
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();
    const badges = useTabBadges();

    return (
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
            {state.routes.map((route, index) => {
                const { options } = descriptors[route.key];
                const label = typeof options.title === 'string' ? options.title : route.name;
                const focused = state.index === index;

                const onPress = () => {
                    const event = navigation.emit({
                        type: 'tabPress',
                        target: route.key,
                        canPreventDefault: true,
                    });
                    if (!focused && !event.defaultPrevented) {
                        void Haptics.impactAsync(
                            route.name === CENTER_ROUTE
                                ? Haptics.ImpactFeedbackStyle.Medium
                                : Haptics.ImpactFeedbackStyle.Light,
                        );
                        navigation.navigate(route.name, route.params);
                    }
                };

                const shared = {
                    label,
                    icon: ICONS[route.name] ?? Home,
                    focused,
                    showDot: badges[route.name] ?? false,
                    onPress,
                    onLongPress: () =>
                        navigation.emit({ type: 'tabLongPress', target: route.key }),
                };

                return route.name === CENTER_ROUTE ? (
                    <CenterButton key={route.key} {...shared} />
                ) : (
                    <TabItem key={route.key} {...shared} />
                );
            })}
        </View>
    );
}

interface ItemProps {
    label: string;
    icon: LucideIcon;
    focused: boolean;
    /** Point rouge : quelque chose de nouveau attend l'utilisateur */
    showDot: boolean;
    onPress: () => void;
    onLongPress: () => void;
}

/** Onglet standard : icône + point lumineux + libellé en fondu */
function TabItem({ label, icon: Icon, focused, showDot, onPress, onLongPress }: ItemProps) {
    const progress = useSharedValue(focused ? 1 : 0);

    useEffect(() => {
        progress.value = withSpring(focused ? 1 : 0, SPRING);
    }, [focused, progress]);

    const iconWrapStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: -2 * progress.value },
            { scale: 1 + 0.08 * progress.value },
        ],
    }));

    const activeIconStyle = useAnimatedStyle(() => ({
        opacity: progress.value,
    }));

    // Libellé et point : slots à hauteur FIXE, seule l'opacité change
    // (aucun changement de layout → aucun glitch possible)
    const revealStyle = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [{ translateY: 2 * (1 - progress.value) }],
    }));

    return (
        <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            style={styles.item}
            hitSlop={6}
        >
            <Animated.View style={iconWrapStyle}>
                <Icon size={19} color={INACTIVE_ICON} strokeWidth={2} />
                <Animated.View style={[StyleSheet.absoluteFill, activeIconStyle]}>
                    <Icon size={19} color="#FFFFFF" strokeWidth={2.3} />
                </Animated.View>
                {showDot && <View style={styles.notifDot} />}
            </Animated.View>

            <Animated.View style={[styles.reveal, revealStyle]}>
                <Animated.Text style={styles.label} numberOfLines={1}>
                    {label}
                </Animated.Text>
                <View style={styles.dot} />
            </Animated.View>
        </Pressable>
    );
}

/** Bouton central flottant — la Recherche, l'action reine */
function CenterButton({ label, icon: Icon, focused, onPress, onLongPress }: ItemProps) {
    const progress = useSharedValue(focused ? 1 : 0);

    useEffect(() => {
        progress.value = withSpring(focused ? 1 : 0, SPRING);
    }, [focused, progress]);

    const fabStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: 1 + 0.08 * progress.value },
            { translateY: -2 * progress.value },
        ],
    }));

    return (
        <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            style={styles.centerSlot}
        >
            <Animated.View style={[styles.fabHalo, fabStyle]}>
                <LinearGradient
                    colors={[palette.navy600, palette.navy800]}
                    start={{ x: 0.2, y: 0 }}
                    end={{ x: 0.8, y: 1 }}
                    style={styles.fab}
                >
                    <Icon size={21} color="#FFFFFF" strokeWidth={2.4} />
                </LinearGradient>
            </Animated.View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: palette.navy900,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        paddingTop: spacing.xs + 2,
        paddingHorizontal: spacing.sm,
        ...shadows.raised,
        shadowOffset: { width: 0, height: -4 },
        elevation: 16,
    },
    item: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
    },
    reveal: {
        alignItems: 'center',
        gap: 2,
        height: 14, // slot fixe : libellé + point n'affectent jamais le layout
        marginTop: 2,
    },
    label: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs - 3,
        color: '#FFFFFF',
        maxWidth: 76,
    },
    dot: {
        width: 3.5,
        height: 3.5,
        borderRadius: radii.full,
        backgroundColor: palette.navy100, // même famille que la marque
    },
    notifDot: {
        position: 'absolute',
        top: -3,
        right: -5,
        width: 9,
        height: 9,
        borderRadius: radii.full,
        backgroundColor: palette.red600,
        borderWidth: 1.5,
        borderColor: palette.navy900,
    },
    centerSlot: {
        flex: 1.1,
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    fabHalo: {
        marginTop: -24, // flotte au-dessus de la barre
        padding: 3,
        borderRadius: radii.full,
        backgroundColor: colors.background, // anneau clair qui détache le bouton
        ...shadows.raised,
    },
    fab: {
        width: 48,
        height: 48,
        borderRadius: radii.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
