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
    Trophy,
    CalendarCheck,
    Share2,
    Medal,
} from 'lucide-react-native';
import { api } from '../../lib/api';
import { useAuth } from '../../stores/auth';
import { useMyArtisanProfile } from '../../features/artisan/hooks';
import { suppressLock } from '../../lib/lockGuard';
import { LoginInvite } from '../../components/LoginInvite';
import { Avatar } from '../../components/ui';
import { colors, palette, spacing, typography, fontSizes, radii, shadows } from '../../theme/tokens';

/** Palettes des pastilles d'icône (variées mais cohérentes) */
const CHIP = {
    navy: { bg: colors.primarySoft, fg: colors.primary },
    terracotta: { bg: '#FEEBE0', fg: palette.terracotta700 },
    green: { bg: colors.successSoft, fg: palette.green700 },
    amber: { bg: colors.warningSoft, fg: '#B45309' },
} as const;
type ChipTone = keyof typeof CHIP;

const AMBASSADEUR_COLOR: Record<'BRONZE' | 'ARGENT' | 'OR', string> = {
    BRONZE: '#B45309',
    ARGENT: '#64748B',
    OR: '#CA8A04',
};

export default function ProfilScreen() {
    const status = useAuth((s) => s.status);

    if (status !== 'authenticated') {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <LoginInvite
                    title="Votre profil"
                    message="Connectez-vous pour gérer votre compte, vos favoris et parrainer vos proches."
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
    const isArtisan = user?.role === 'ARTISAN';
    const isAdmin = user?.role === 'ADMIN';

    const { data: monArtisan } = useMyArtisanProfile(isArtisan);
    const { data: referral } = useQuery({
        queryKey: ['referral', 'code'],
        queryFn: async () => {
            const { data } = await api.get<{ code: string }>('/referral/my-code');
            return data;
        },
        staleTime: Infinity,
    });

    const nom = `${user?.prenom ?? ''} ${user?.nom ?? ''}`.trim() || user?.email || 'Utilisateur';
    const niveau = monArtisan?.ambassadeurNiveau ?? null;
    const profilIncomplet = !user?.prenom || !user?.telephone || !user?.photoUrl;

    const shareCode = async () => {
        if (!referral?.code) return;
        suppressLock();
        await Share.share({
            message: `Rejoins AlloArtisan avec mon code parrain ${referral.code} : on gagne chacun des jours d'abonnement offerts ! 🛠️`,
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
                {/* ─── Carte d'identité ─── */}
                <Pressable
                    style={styles.identity}
                    onPress={() => router.push('/parametres')}
                    accessibilityRole="button"
                    accessibilityLabel="Modifier mon profil"
                >
                    <Avatar name={nom} uri={user?.photoUrl} size={60} />
                    <View style={{ flex: 1 }}>
                        <View style={styles.nameRow}>
                            <Text style={styles.name} numberOfLines={1}>
                                {nom}
                            </Text>
                            {user?.emailVerified && (
                                <BadgeCheck size={17} color={colors.primary} strokeWidth={2.2} />
                            )}
                            {niveau && (
                                <Medal size={16} color={AMBASSADEUR_COLOR[niveau]} strokeWidth={2.2} />
                            )}
                        </View>
                        <Text style={styles.email} numberOfLines={1}>
                            {user?.email}
                        </Text>
                        <View style={styles.roleChip}>
                            <Text style={styles.roleChipTxt}>
                                {isAdmin ? 'Admin' : isArtisan ? 'Artisan' : 'Client'}
                            </Text>
                        </View>
                    </View>
                    <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
                </Pressable>

                {/* Profil incomplet */}
                {profilIncomplet && (
                    <Pressable
                        onPress={() => router.push('/completer-profil')}
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.completeBanner, pressed && { opacity: 0.9 }]}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={styles.completeTitle} numberOfLines={1}>
                                Complétez votre profil
                            </Text>
                            <Text style={styles.completeText} numberOfLines={1}>
                                Photo, téléphone : 2 min pour inspirer confiance
                            </Text>
                        </View>
                        <ChevronRight size={18} color={colors.primary} strokeWidth={2.2} />
                    </Pressable>
                )}

                {/* ─── Accès rapides (grille de tuiles) ─── */}
                <View style={styles.grid}>
                    {isArtisan ? (
                        <>
                            <QuickTile
                                tone="navy"
                                icon={BarChart3}
                                label="Mon activité"
                                onPress={() => router.push('/activite')}
                            />
                            <QuickTile
                                tone="amber"
                                icon={Gauge}
                                label="Abonnement"
                                onPress={() => router.push('/abonnement')}
                            />
                            <QuickTile
                                tone="terracotta"
                                icon={Images}
                                label="Réalisations"
                                onPress={() => router.push('/mes-realisations')}
                            />
                            <QuickTile
                                tone="green"
                                icon={Trophy}
                                label="Ambassadeur"
                                onPress={() => router.push('/recompenses')}
                            />
                        </>
                    ) : (
                        <>
                            <QuickTile
                                tone="amber"
                                icon={Star}
                                label="Mes favoris"
                                onPress={() => router.push('/favoris')}
                            />
                            <QuickTile
                                tone="navy"
                                icon={CalendarCheck}
                                label="Mes réservations"
                                onPress={() => router.push('/(tabs)/reservations')}
                            />
                            <QuickTile
                                tone="green"
                                icon={Hammer}
                                label="Devenir artisan"
                                onPress={() => router.push('/artisan-onboarding')}
                            />
                            <QuickTile
                                tone="terracotta"
                                icon={HelpCircle}
                                label="Aide"
                                onPress={() => router.push('/aide')}
                            />
                        </>
                    )}
                </View>

                {/* ─── Bannière parrainage (Ambassadeur) — ARTISANS uniquement :
                    la récompense est en jours d'abonnement, sans objet pour un client ─── */}
                {isArtisan && (
                    <Pressable
                        style={styles.ambassador}
                        onPress={() => router.push('/recompenses')}
                        accessibilityRole="button"
                    >
                        <View style={styles.ambassadorIcon}>
                            <Gift size={20} color={palette.white} strokeWidth={2} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.ambassadorTitle} numberOfLines={1}>
                                Programme Ambassadeur
                            </Text>
                            <Text style={styles.ambassadorText} numberOfLines={2}>
                                Parrainez et gagnez des jours d'abonnement offerts + un badge.
                            </Text>
                        </View>
                        <Pressable onPress={shareCode} hitSlop={10} style={styles.ambassadorShare}>
                            <Share2 size={16} color={palette.white} strokeWidth={2.2} />
                        </Pressable>
                    </Pressable>
                )}

                {/* ─── Admin ─── */}
                {isAdmin && (
                    <Section title="Administration">
                        <Row
                            tone="navy"
                            icon={LayoutDashboard}
                            label="Administration"
                            onPress={() => router.push('/admin')}
                        />
                    </Section>
                )}

                {/* ─── Espace pro (artisan) ─── */}
                {isArtisan && (
                    <Section title="Espace professionnel">
                        <Row
                            tone="navy"
                            icon={UserRoundCog}
                            label="Profil professionnel"
                            onPress={() => router.push('/profil-pro')}
                        />
                        <Row
                            tone="green"
                            icon={ShieldCheck}
                            label="Vérification et justificatifs"
                            onPress={() => router.push('/justificatifs')}
                        />
                    </Section>
                )}

                {/* ─── Main-d'œuvre ─── */}
                <Section title="Main-d'œuvre">
                    {isArtisan && (
                        <Row
                            tone="terracotta"
                            icon={Users}
                            label="Chercher de la main-d'œuvre"
                            onPress={() => router.push('/main-doeuvre')}
                        />
                    )}
                    <Row
                        tone="terracotta"
                        icon={Hammer}
                        label="Me rendre disponible"
                        subtitle="Travailler comme ouvrier ou aide"
                        onPress={() => router.push('/profil-travailleur')}
                    />
                    <Row
                        tone="terracotta"
                        icon={Megaphone}
                        label="Annonces de chantier"
                        onPress={() => router.push('/annonces-chantier')}
                    />
                </Section>

                {/* ─── Compte & aide ─── */}
                <Section title="Compte & aide">
                    {isArtisan && (
                        <>
                            <Row
                                tone="navy"
                                icon={Wallet}
                                label="Mes paiements"
                                onPress={() => router.push('/paiements')}
                            />
                            <Row
                                tone="amber"
                                icon={Star}
                                label="Mes favoris"
                                onPress={() => router.push('/favoris')}
                            />
                        </>
                    )}
                    <Row
                        tone="navy"
                        icon={Settings}
                        label="Paramètres du compte"
                        onPress={() => router.push('/parametres')}
                    />
                    {isArtisan && (
                        <Row
                            tone="terracotta"
                            icon={HelpCircle}
                            label="Aide et support"
                            onPress={() => router.push('/aide')}
                        />
                    )}
                </Section>

                {/* Déconnexion */}
                <Pressable onPress={confirmLogout} style={styles.logout} accessibilityRole="button">
                    <LogOut size={18} color={colors.danger} strokeWidth={2} />
                    <Text style={styles.logoutText}>Se déconnecter</Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

type IconType = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** Tuile d'accès rapide (grille) */
function QuickTile({
    tone,
    icon: Icon,
    label,
    onPress,
}: {
    tone: ChipTone;
    icon: IconType;
    label: string;
    onPress?: () => void;
}) {
    const c = CHIP[tone];
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={({ pressed }) => [styles.tile, pressed && { transform: [{ scale: 0.98 }] }]}
        >
            <View style={[styles.tileIcon, { backgroundColor: c.bg }]}>
                <Icon size={20} color={c.fg} strokeWidth={2.2} />
            </View>
            <Text style={styles.tileLabel} numberOfLines={1} adjustsFontSizeToFit>
                {label}
            </Text>
        </Pressable>
    );
}

/** Section groupée (titre + carte) */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.sectionCard}>{children}</View>
        </View>
    );
}

/** Ligne de menu (pastille + label + sous-titre + chevron) */
function Row({
    tone,
    icon: Icon,
    label,
    subtitle,
    onPress,
}: {
    tone: ChipTone;
    icon: IconType;
    label: string;
    subtitle?: string;
    onPress?: () => void;
}) {
    const c = CHIP[tone];
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
        >
            <View style={[styles.rowIcon, { backgroundColor: c.bg }]}>
                <Icon size={17} color={c.fg} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel} numberOfLines={1}>
                    {label}
                </Text>
                {subtitle ? (
                    <Text style={styles.rowSub} numberOfLines={1}>
                        {subtitle}
                    </Text>
                ) : null}
            </View>
            <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: spacing.xl, paddingBottom: spacing['3xl'] },

    // Identité
    identity: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radii.xl,
        padding: spacing.lg,
        marginTop: spacing.lg,
        marginBottom: spacing.lg,
        ...shadows.card,
    },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    name: {
        fontFamily: typography.heading,
        fontSize: fontSizes.lg,
        color: colors.text,
        flexShrink: 1,
    },
    email: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: 1,
    },
    roleChip: {
        alignSelf: 'flex-start',
        backgroundColor: colors.primarySoft,
        borderRadius: radii.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        marginTop: 5,
    },
    roleChipTxt: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs - 1,
        color: colors.primary,
    },

    // Bannière complétion
    completeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.primarySoft,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.navy100,
        padding: spacing.md,
        marginBottom: spacing.lg,
    },
    completeTitle: {
        fontFamily: typography.headingMedium,
        fontSize: fontSizes.sm,
        color: colors.primary,
    },
    completeText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: 1,
    },

    // Grille d'accès rapides
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    tile: {
        flexBasis: '47%',
        flexGrow: 1,
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.sm,
        ...shadows.card,
    },
    tileIcon: {
        width: 44,
        height: 44,
        borderRadius: radii.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tileLabel: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.text,
    },

    // Bannière Ambassadeur
    ambassador: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.primary,
        borderRadius: radii.lg,
        padding: spacing.lg,
        marginBottom: spacing['2xl'],
    },
    ambassadorIcon: {
        width: 40,
        height: 40,
        borderRadius: radii.full,
        backgroundColor: 'rgba(255,255,255,0.16)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ambassadorTitle: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.base,
        color: palette.white,
    },
    ambassadorText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: fontSizes.xs + 5,
        color: 'rgba(255,255,255,0.85)',
        marginTop: 1,
    },
    ambassadorShare: {
        width: 34,
        height: 34,
        borderRadius: radii.full,
        backgroundColor: 'rgba(255,255,255,0.16)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Sections
    section: { marginBottom: spacing.lg },
    sectionTitle: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        color: colors.textMuted,
        marginBottom: spacing.sm,
        marginLeft: spacing.xs,
    },
    sectionCard: {
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        overflow: 'hidden',
        ...shadows.card,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        minHeight: 56,
    },
    rowIcon: {
        width: 34,
        height: 34,
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowLabel: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.base,
        color: colors.text,
    },
    rowSub: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: 1,
    },

    // Déconnexion
    logout: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        marginTop: spacing.lg,
        padding: spacing.md,
    },
    logoutText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.base,
        color: colors.danger,
    },
});
