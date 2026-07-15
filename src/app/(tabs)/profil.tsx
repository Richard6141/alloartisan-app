import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Share, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
    Gift,
    ChevronRight,
    LogOut,
    Star,
    BadgeCheck,
    Settings,
    HelpCircle,
    BarChart3,
    Wallet,
    UserRoundCog,
    ShieldCheck,
    Images,
    Gauge,
    LayoutDashboard,
    Users,
    Hammer,
    Megaphone,
} from 'lucide-react-native';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { useAuth } from '../../stores/auth';
import { suppressLock } from '../../lib/lockGuard';
import { LoginInvite } from '../../components/LoginInvite';
import { Avatar, Card } from '../../components/ui';
import { colors, palette, spacing, typography, fontSizes, radii, shadows } from '../../theme/tokens';

export default function ProfilScreen() {
    const status = useAuth((s) => s.status);

    if (status !== 'authenticated') {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <LoginInvite
                    title="Votre profil"
                    message="Connectez-vous pour gérer votre compte, vos favoris et gagner des récompenses de parrainage."
                />
            </SafeAreaView>
        );
    }

    return <ProfileContent />;
}

function ProfileContent() {
    const router = useRouter();
    const user = useAuth((s) => s.user);
    const logout = useAuth((s) => s.logout);

    const { data: referral } = useQuery({
        queryKey: ['referral', 'code'],
        queryFn: async () => {
            const { data } = await api.get<{ code: string }>('/referral/my-code');
            return data;
        },
        staleTime: Infinity,
    });

    const nom = `${user?.prenom ?? ''} ${user?.nom ?? ''}`.trim() || user?.email || 'Utilisateur';

    const shareCode = async () => {
        if (!referral?.code) return;
        suppressLock(); // la feuille de partage ne doit pas déclencher l'empreinte
        await Share.share({
            message:
                `Rejoins-moi sur AlloArtisan ! Les meilleurs artisans du Bénin, suivis en temps réel. ` +
                `Utilise mon code ${referral.code} et gagne 500 F sur ta première intervention. 🛠️`,
        });
    };

    const confirmLogout = () => {
        Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Se déconnecter', style: 'destructive', onPress: () => void logout() },
        ]);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* En-tête profil */}
                <View style={styles.header}>
                    <Avatar name={nom} uri={user?.photoUrl} size={72} />
                    <View style={{ flex: 1 }}>
                        <View style={styles.nameRow}>
                            <Text style={styles.name} numberOfLines={1}>
                                {nom}
                            </Text>
                            {user?.emailVerified && (
                                <BadgeCheck size={18} color={colors.primary} strokeWidth={2.2} />
                            )}
                        </View>
                        <Text style={styles.email} numberOfLines={1}>
                            {user?.email}
                        </Text>
                        <Text style={styles.role}>
                            {user?.role === 'ARTISAN' ? 'Compte artisan' : 'Compte client'}
                        </Text>
                    </View>
                </View>

                {/* Profil incomplet : invitation à le compléter en 4 étapes */}
                {(!user?.prenom || !user?.telephone || !user?.photoUrl) && (
                    <Pressable
                        onPress={() => router.push('/completer-profil')}
                        accessibilityRole="button"
                        style={({ pressed }) => [
                            styles.completeBanner,
                            pressed && { opacity: 0.9 },
                        ]}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={styles.completeTitle}>Complétez votre profil</Text>
                            <Text style={styles.completeText}>
                                Photo, téléphone, adresse : 2 minutes pour inspirer confiance
                            </Text>
                        </View>
                        <ChevronRight size={18} color={colors.primary} strokeWidth={2.2} />
                    </Pressable>
                )}

                {/* Carte parrainage */}
                <Card style={styles.referralCard}>
                    <View style={styles.referralHeader}>
                        <Gift size={20} color={colors.accent} strokeWidth={2} />
                        <Text style={styles.referralTitle}>Parrainez et gagnez 1 000 F</Text>
                    </View>
                    <Text style={styles.referralText}>
                        Votre filleul gagne 500 F, vous gagnez 1 000 F dès sa première
                        intervention payée.
                    </Text>
                    <Pressable
                        onPress={shareCode}
                        style={styles.codeBox}
                        accessibilityRole="button"
                        accessibilityLabel="Partager mon code parrainage"
                    >
                        <Text style={styles.codeText}>{referral?.code ?? '••••••'}</Text>
                        <Text style={styles.codeShare}>Partager</Text>
                    </Pressable>
                </Card>

                {/* Espace administration : validation des artisans et pilotage */}
                {user?.role === 'ADMIN' && (
                    <View style={styles.menu}>
                        <MenuItem
                            icon={
                                <LayoutDashboard
                                    size={20}
                                    color={colors.textSecondary}
                                    strokeWidth={2}
                                />
                            }
                            label="Administration"
                            onPress={() => router.push('/admin')}
                        />
                    </View>
                )}

                {/* Espace pro : tout ce qui construit la fiche publique de l'artisan */}
                {user?.role === 'ARTISAN' && (
                    <View style={styles.menu}>
                        <MenuItem
                            icon={
                                <BarChart3
                                    size={20}
                                    color={colors.textSecondary}
                                    strokeWidth={2}
                                />
                            }
                            label="Mon activité"
                            onPress={() => router.push('/activite')}
                        />
                        <MenuItem
                            icon={
                                <UserRoundCog
                                    size={20}
                                    color={colors.textSecondary}
                                    strokeWidth={2}
                                />
                            }
                            label="Profil professionnel"
                            onPress={() => router.push('/profil-pro')}
                        />
                        <MenuItem
                            icon={
                                <ShieldCheck
                                    size={20}
                                    color={colors.textSecondary}
                                    strokeWidth={2}
                                />
                            }
                            label="Vérification et justificatifs"
                            onPress={() => router.push('/justificatifs')}
                        />
                        <MenuItem
                            icon={
                                <Images size={20} color={colors.textSecondary} strokeWidth={2} />
                            }
                            label="Mes réalisations"
                            onPress={() => router.push('/mes-realisations')}
                        />
                        <MenuItem
                            icon={
                                <Gauge size={20} color={colors.textSecondary} strokeWidth={2} />
                            }
                            label="Mon abonnement"
                            onPress={() => router.push('/abonnement')}
                        />
                    </View>
                )}

                {/* Main-d'œuvre */}
                <View style={styles.menu}>
                    <MenuItem
                        icon={<Users size={20} color={colors.textSecondary} strokeWidth={2} />}
                        label="Chercher de la main-d'œuvre"
                        onPress={() => router.push('/main-doeuvre')}
                    />
                    <MenuItem
                        icon={<Hammer size={20} color={colors.textSecondary} strokeWidth={2} />}
                        label="Me rendre disponible pour du travail"
                        onPress={() => router.push('/profil-travailleur')}
                    />
                    <MenuItem
                        icon={<Megaphone size={20} color={colors.textSecondary} strokeWidth={2} />}
                        label="Annonces de chantier près de moi"
                        onPress={() => router.push('/annonces-chantier')}
                    />
                </View>

                {/* Menu */}
                <View style={styles.menu}>
                    <MenuItem
                        icon={<Wallet size={20} color={colors.textSecondary} strokeWidth={2} />}
                        label="Mes paiements"
                        onPress={() => router.push('/paiements')}
                    />
                    <MenuItem
                        icon={<Star size={20} color={colors.textSecondary} strokeWidth={2} />}
                        label="Mes favoris"
                        onPress={() => router.push('/favoris')}
                    />
                    <MenuItem
                        icon={<Gift size={20} color={colors.textSecondary} strokeWidth={2} />}
                        label="Mes récompenses"
                        onPress={() => router.push('/recompenses')}
                    />
                    <MenuItem
                        icon={<Settings size={20} color={colors.textSecondary} strokeWidth={2} />}
                        label="Paramètres du compte"
                        onPress={() => router.push('/parametres')}
                    />
                    <MenuItem
                        icon={<HelpCircle size={20} color={colors.textSecondary} strokeWidth={2} />}
                        label="Aide et support"
                        onPress={() => router.push('/aide')}
                    />
                </View>

                {/* Déconnexion — séparée des actions normales */}
                <Pressable onPress={confirmLogout} style={styles.logout} accessibilityRole="button">
                    <LogOut size={18} color={colors.danger} strokeWidth={2} />
                    <Text style={styles.logoutText}>Se déconnecter</Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

function MenuItem({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress?: () => void }) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.surfaceMuted }]}
        >
            {icon}
            <Text style={styles.menuLabel}>{label}</Text>
            <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing['3xl'],
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg,
        paddingVertical: spacing['2xl'],
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    name: {
        fontFamily: typography.heading,
        fontSize: fontSizes.xl,
        color: colors.text,
        flexShrink: 1,
    },
    email: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        marginTop: 2,
    },
    role: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        color: colors.primary,
        marginTop: 2,
    },
    completeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.primarySoft,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.navy100,
        padding: spacing.lg,
        marginBottom: spacing.lg,
    },
    completeTitle: {
        fontFamily: typography.headingMedium,
        fontSize: fontSizes.base,
        color: colors.primary,
    },
    completeText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: 1,
    },
    referralCard: {
        gap: spacing.sm,
        marginBottom: spacing['2xl'],
    },
    referralHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    referralTitle: {
        fontFamily: typography.heading,
        fontSize: fontSizes.md,
        color: colors.text,
    },
    referralText: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    codeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.accentSoft,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.accent,
        borderStyle: 'dashed',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        marginTop: spacing.xs,
    },
    codeText: {
        fontFamily: typography.heading,
        fontSize: fontSizes.lg,
        letterSpacing: 2,
        color: colors.accentPressed,
    },
    codeShare: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.accent,
    },
    menu: {
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        overflow: 'hidden',
        ...shadows.card,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        height: 54,
    },
    menuLabel: {
        flex: 1,
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.base,
        color: colors.text,
    },
    logout: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        marginTop: spacing['3xl'],
        padding: spacing.md,
    },
    logoutText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.base,
        color: colors.danger,
    },
});
