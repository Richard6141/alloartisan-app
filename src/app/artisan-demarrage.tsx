import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ArrowLeft,
    BadgeCheck,
    Check,
    ChevronRight,
    Clock4,
    ContactRound,
    GraduationCap,
    Hourglass,
    Images,
    PartyPopper,
    UserRoundCog,
    XCircle,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useAuth } from '../stores/auth';
import { LoginInvite } from '../components/LoginInvite';
import { Card, Skeleton } from '../components/ui';
import {
    useMyArtisanProfile,
    useMyCertifications,
    usePortfolio,
} from '../features/artisan/hooks';
import { colors, palette, spacing, typography, fontSizes, lineHeights, radii, shadows } from '../theme/tokens';

/**
 * Guide de démarrage artisan : oriente le nouvel artisan pas à pas jusqu'à ce
 * que son compte soit complet et vérifié. Chaque étape indique son état et
 * mène à l'écran qui la traite. C'est le tableau de bord d'accueil du pro
 * tant qu'il n'est pas validé.
 */

type EtatEtape = 'a_faire' | 'envoye' | 'valide' | 'refuse';

interface Etape {
    icone: LucideIcon;
    titre: string;
    sousTitre: string;
    etat: EtatEtape;
    route: string;
    /** Compte dans la barre de progression (les réalisations sont un bonus) */
    requis: boolean;
}

export default function ArtisanDemarrageScreen() {
    const router = useRouter();
    const isArtisan = useAuth((s) => s.status === 'authenticated' && s.user?.role === 'ARTISAN');

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
                <Text style={styles.title}>Bien démarrer</Text>
                <View style={{ width: 38 }} />
            </View>
            {!isArtisan ? (
                <LoginInvite
                    title="Espace artisan"
                    message="Connectez-vous avec un compte artisan pour configurer votre profil."
                />
            ) : (
                <DemarrageContent />
            )}
        </SafeAreaView>
    );
}

function etatDepuisCert(
    cert: { statutVerification: 'EN_ATTENTE' | 'VALIDEE' | 'REJETEE' } | undefined,
): EtatEtape {
    if (!cert) return 'a_faire';
    if (cert.statutVerification === 'VALIDEE') return 'valide';
    if (cert.statutVerification === 'REJETEE') return 'refuse';
    return 'envoye';
}

function DemarrageContent() {
    const router = useRouter();
    const { data: me, isLoading } = useMyArtisanProfile();
    const { data: certifications } = useMyCertifications();
    const { data: portfolio } = usePortfolio(me?.id);

    if (isLoading && !me) {
        return (
            <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
                <Skeleton height={130} borderRadius={radii.lg} />
                <Skeleton height={76} borderRadius={radii.lg} />
                <Skeleton height={76} borderRadius={radii.lg} />
                <Skeleton height={76} borderRadius={radii.lg} />
            </View>
        );
    }

    const certs = certifications ?? [];
    const identite = certs.find((c) => c.type === 'IDENTITE');
    const principalId = me?.metiers?.find((m) => m.estPrincipal)?.metier.id;
    const preuvePrincipal = certs.find((c) => c.type === 'METIER' && c.metierId === principalId);
    const aDesPhotos = (portfolio?.total ?? 0) > 0;

    // Vitrine « faite » = photo de profil + au moins un métier (les seuls
    // éléments réellement structurants). La présentation (bio), le slogan, les
    // années d'expérience et l'IFU sont OPTIONNELS : ne pas les laisser bloquer
    // l'étape à « à faire » quand l'artisan choisit de ne pas les remplir.
    const vitrineOk = !!(me?.photoProfilUrl && (me?.metiers?.length ?? 0) > 0);

    const etapes: Etape[] = [
        {
            icone: UserRoundCog,
            titre: 'Soigner votre vitrine',
            sousTitre: 'Photo, présentation, zone d’intervention, métiers',
            etat: vitrineOk ? 'valide' : 'a_faire',
            route: '/profil-pro',
            requis: true,
        },
        {
            icone: ContactRound,
            titre: 'Votre pièce d’identité',
            sousTitre: 'Confidentielle, elle prouve qui vous êtes',
            etat: etatDepuisCert(identite),
            route: '/justificatifs',
            requis: true,
        },
        {
            icone: GraduationCap,
            titre: 'Diplôme de votre métier principal',
            sousTitre: 'Diplôme ou attestation pour être certifié',
            etat: etatDepuisCert(preuvePrincipal),
            route: '/justificatifs',
            requis: true,
        },
        {
            icone: Images,
            titre: 'Vos réalisations',
            sousTitre: 'Photos de chantiers : recommandé pour attirer',
            etat: aDesPhotos ? 'valide' : 'a_faire',
            route: '/mes-realisations',
            requis: false,
        },
    ];

    const requises = etapes.filter((e) => e.requis);
    const requisFaites = requises.filter((e) => e.etat === 'valide' || e.etat === 'envoye').length;
    const progress = requisFaites / requises.length;
    const dossierComplet = requisFaites === requises.length;
    const verifie = me?.verified === true;
    const refuse = me?.statut === 'REJETE';

    return (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Bandeau d'état global */}
            {verifie ? (
                <LinearGradient
                    colors={['#047857', '#065F46']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.hero}
                >
                    <View style={styles.heroIcon}>
                        <PartyPopper size={22} color={palette.white} strokeWidth={2} />
                    </View>
                    <Text style={styles.heroTitle}>Profil vérifié 🎉</Text>
                    <Text style={styles.heroText}>
                        Vous êtes visible des clients et recevez leurs demandes. Continuez à
                        enrichir vos réalisations pour vous démarquer.
                    </Text>
                </LinearGradient>
            ) : (
                <LinearGradient
                    colors={[palette.navy800, palette.navy900]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.hero}
                >
                    <View style={styles.heroIcon}>
                        {refuse ? (
                            <XCircle size={22} color={palette.white} strokeWidth={2} />
                        ) : dossierComplet ? (
                            <Hourglass size={22} color={palette.white} strokeWidth={2} />
                        ) : (
                            <BadgeCheck size={22} color={palette.white} strokeWidth={2} />
                        )}
                    </View>
                    <Text style={styles.heroTitle}>
                        {refuse
                            ? 'Dossier à corriger'
                            : dossierComplet
                              ? 'Dossier complet, examen en cours'
                              : 'Finalisez votre inscription'}
                    </Text>
                    <Text style={styles.heroText}>
                        {refuse
                            ? me?.raisonSuspension?.trim()
                                ? `Motif : ${me.raisonSuspension.trim()} Corrigez l’étape concernée ci-dessous.`
                                : 'Un document doit être corrigé. Voyez l’étape concernée ci-dessous.'
                            : dossierComplet
                              ? 'Notre équipe examine vos documents sous 24 à 48 h. Vous serez notifié dès la validation.'
                              : 'Encore quelques étapes et les clients pourront vous trouver.'}
                    </Text>
                    {!dossierComplet && !refuse && (
                        <>
                            <View style={styles.progressTrack}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        { width: `${Math.round(progress * 100)}%` },
                                    ]}
                                />
                            </View>
                            <Text style={styles.progressLabel}>
                                {requisFaites} / {requises.length} étapes essentielles
                            </Text>
                        </>
                    )}
                </LinearGradient>
            )}

            {/* Étapes */}
            <View style={{ gap: spacing.sm }}>
                {etapes.map((etape, i) => (
                    <Pressable
                        key={etape.titre}
                        onPress={() =>
                            router.push(etape.route as Parameters<typeof router.push>[0])
                        }
                        accessibilityRole="button"
                    >
                        <Card style={styles.etapeCard}>
                            <View style={styles.etapeNum}>
                                {etape.etat === 'valide' ? (
                                    <View style={[styles.etapeCheck, { backgroundColor: palette.green600 }]}>
                                        <Check size={13} color={palette.white} strokeWidth={3} />
                                    </View>
                                ) : (
                                    <View style={styles.etapeIcon}>
                                        <etape.icone
                                            size={17}
                                            color={colors.primary}
                                            strokeWidth={2}
                                        />
                                    </View>
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <View style={styles.etapeTitleRow}>
                                    <Text style={styles.etapeTitle} numberOfLines={1}>
                                        {etape.titre}
                                    </Text>
                                    {!etape.requis && (
                                        <Text style={styles.optionnel}>option</Text>
                                    )}
                                </View>
                                <Text style={styles.etapeSous} numberOfLines={1}>
                                    {etape.sousTitre}
                                </Text>
                                <StatutEtape etat={etape.etat} />
                            </View>
                            <ChevronRight size={17} color={colors.textMuted} strokeWidth={2.2} />
                        </Card>
                    </Pressable>
                ))}
            </View>

            <Text style={styles.footNote}>
                Vos documents ne sont jamais montrés aux clients : ils servent uniquement à la
                vérification. Le prix de vos prestations se discute directement avec eux.
            </Text>
        </ScrollView>
    );
}

function StatutEtape({ etat }: { etat: EtatEtape }) {
    if (etat === 'valide') {
        return (
            <View style={styles.chipRow}>
                <BadgeCheck size={12} color={palette.green700} strokeWidth={2.4} />
                <Text style={[styles.chipText, { color: palette.green700 }]}>Fait</Text>
            </View>
        );
    }
    if (etat === 'envoye') {
        return (
            <View style={styles.chipRow}>
                <Clock4 size={12} color={palette.amber600} strokeWidth={2.4} />
                <Text style={[styles.chipText, { color: palette.terracotta700 }]}>
                    En attente d’examen
                </Text>
            </View>
        );
    }
    if (etat === 'refuse') {
        return (
            <View style={styles.chipRow}>
                <XCircle size={12} color={palette.red600} strokeWidth={2.4} />
                <Text style={[styles.chipText, { color: palette.red700 }]}>À corriger</Text>
            </View>
        );
    }
    return (
        <View style={styles.chipRow}>
            <View style={styles.chipDot} />
            <Text style={[styles.chipText, { color: colors.textSecondary }]}>À faire</Text>
        </View>
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
        paddingBottom: spacing['3xl'],
        gap: spacing.lg,
    },
    hero: {
        borderRadius: radii.xl,
        padding: spacing.lg,
        gap: spacing.sm,
        ...shadows.card,
    },
    heroIcon: {
        width: 42,
        height: 42,
        borderRadius: radii.full,
        backgroundColor: 'rgba(255,255,255,0.16)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroTitle: {
        fontFamily: typography.heading,
        fontSize: fontSizes.lg,
        color: palette.white,
        letterSpacing: -0.3,
        marginTop: spacing.xs,
    },
    heroText: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        lineHeight: lineHeights.sm + 4,
        color: 'rgba(255,255,255,0.78)',
    },
    progressTrack: {
        height: 6,
        borderRadius: radii.full,
        backgroundColor: 'rgba(255,255,255,0.18)',
        overflow: 'hidden',
        marginTop: spacing.sm,
    },
    progressFill: {
        height: '100%',
        borderRadius: radii.full,
        backgroundColor: '#4ADE80',
    },
    progressLabel: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
        color: 'rgba(255,255,255,0.85)',
    },
    etapeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    etapeNum: {
        width: 34,
        alignItems: 'center',
    },
    etapeIcon: {
        width: 34,
        height: 34,
        borderRadius: radii.full,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    etapeCheck: {
        width: 26,
        height: 26,
        borderRadius: radii.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    etapeTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    etapeTitle: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.sm,
        color: colors.text,
        flexShrink: 1,
    },
    optionnel: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs - 2,
        color: colors.textMuted,
        backgroundColor: colors.surfaceMuted,
        borderRadius: radii.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: 1,
        overflow: 'hidden',
    },
    etapeSous: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: 1,
    },
    chipRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 3,
    },
    chipText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
    },
    chipDot: {
        width: 7,
        height: 7,
        borderRadius: radii.full,
        backgroundColor: colors.borderStrong,
    },
    footNote: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 4,
        color: colors.textMuted,
    },
});
