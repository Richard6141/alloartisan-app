import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ChevronRight,
    FileWarning,
    Gauge,
    Gift,
    Rocket,
    ShieldCheck,
    XCircle,
} from 'lucide-react-native';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../stores/auth';
import { useMyArtisanProfile, useMyCertifications, useMySubscription } from './hooks';
import { colors, palette, spacing, typography, fontSizes, lineHeights, radii, shadows } from '../../theme/tokens';

/**
 * Statut des mises en relation sur l'accueil (artisan vérifié) :
 * - tant qu'il reste des ESSAIS DÉCOUVERTE gratuits → encouragement (vert) ;
 * - une fois les essais épuisés, nudge d'abonnement quand le quota est bas/épuisé.
 * Invisible sinon (ou pour les paliers illimités). Complète la carte de vérification.
 */
export function ArtisanQuotaCard() {
    const router = useRouter();
    const isArtisan = useAuth((s) => s.status === 'authenticated' && s.user?.role === 'ARTISAN');
    const { data: me } = useMyArtisanProfile(isArtisan);
    const { data: sub } = useMySubscription(isArtisan && me?.verified === true);

    if (!isArtisan || !me?.verified || !sub) return null;
    if (sub.demandesRestantes == null) return null; // palier illimité (GOLD)

    const essaisRestants = sub.essaisRestants ?? 0;

    // ─── Encore des essais découverte gratuits : encouragement, PAS d'alarme ──
    // (corrige le faux « quota épuisé » à la validation du compte)
    if (essaisRestants > 0) {
        const s = essaisRestants > 1 ? 's' : '';
        return (
            <Pressable onPress={() => router.push('/abonnement')} accessibilityRole="button">
                <View style={[styles.card, { backgroundColor: palette.green100 }]}>
                    <Gift size={19} color={palette.green700} strokeWidth={2} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.title, { color: palette.green700 }]}>
                            {essaisRestants} mise{s} en relation offerte{s}
                        </Text>
                        <Text
                            style={[styles.subtitle, { color: colors.textSecondary }]}
                            numberOfLines={1}
                        >
                            Contactez vos premiers clients gratuitement
                        </Text>
                    </View>
                    <ChevronRight size={17} color={palette.green700} strokeWidth={2.2} />
                </View>
            </Pressable>
        );
    }

    // ─── Essais épuisés : nudge d'abonnement quand ça devient bas/épuisé ─────
    if (sub.demandesRestantes > 1) return null;
    const epuise = sub.demandesRestantes === 0;
    const gratuit = sub.plan === 'GRATUIT';

    return (
        <Pressable onPress={() => router.push('/abonnement')} accessibilityRole="button">
            <View
                style={[
                    styles.card,
                    { backgroundColor: epuise ? colors.dangerSoft : colors.warningSoft },
                ]}
            >
                {epuise ? (
                    <Gauge size={19} color={palette.red700} strokeWidth={2} />
                ) : (
                    <Rocket size={19} color={palette.terracotta700} strokeWidth={2} />
                )}
                <View style={{ flex: 1 }}>
                    <Text
                        style={[
                            styles.title,
                            { color: epuise ? palette.red700 : palette.terracotta700 },
                        ]}
                    >
                        {epuise
                            ? gratuit
                                ? 'Essais découverte épuisés'
                                : 'Quota du mois épuisé'
                            : 'Plus qu’une mise en relation ce mois'}
                    </Text>
                    <Text
                        style={[styles.subtitle, { color: colors.textSecondary }]}
                        numberOfLines={1}
                    >
                        {epuise
                            ? gratuit
                                ? 'Abonnez-vous pour contacter vos clients'
                                : 'Passez à un palier supérieur pour être recontacté'
                            : 'Passez à un palier supérieur pour ne rien manquer'}
                    </Text>
                </View>
                <ChevronRight
                    size={17}
                    color={epuise ? palette.red700 : palette.terracotta700}
                    strokeWidth={2.2}
                />
            </View>
        </Pressable>
    );
}

/**
 * Bandeau compact de vérification artisan, affiché sur l'accueil.
 * Une seule rangée + mini barre de progression : il guide sans envahir.
 * Disparaît une fois le profil vérifié (sauf document refusé à corriger).
 */
export function ArtisanVerificationCard() {
    const router = useRouter();
    const isArtisan = useAuth((s) => s.status === 'authenticated' && s.user?.role === 'ARTISAN');
    const { data: me, error } = useMyArtisanProfile(isArtisan);
    const { data: certifications } = useMyCertifications(isArtisan && !!me);

    if (!isArtisan) return null;

    // ─── Pas encore de profil artisan ─────────────────────────────────────────
    if (!me) {
        if (error instanceof ApiError && error.status === 404) {
            return (
                <Pressable
                    onPress={() => router.push('/artisan-onboarding')}
                    accessibilityRole="button"
                >
                    <LinearGradient
                        colors={[palette.navy800, palette.navy900]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.card}
                    >
                        <ShieldCheck size={19} color={palette.white} strokeWidth={2} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.title}>Créez votre profil artisan</Text>
                            <Text style={styles.subtitle} numberOfLines={1}>
                                2 minutes pour devenir visible des clients
                            </Text>
                        </View>
                        <ChevronRight size={17} color="rgba(255,255,255,0.8)" strokeWidth={2.2} />
                    </LinearGradient>
                </Pressable>
            );
        }
        return null; // chargement ou erreur réseau : rien d'intrusif
    }

    const certs = certifications ?? [];
    const identite = certs.find((c) => c.type === 'IDENTITE') ?? null;
    const principalId = me.metiers?.find((m) => m.estPrincipal)?.metier.id;
    const preuvePrincipal =
        certs.find((c) => c.type === 'METIER' && c.metierId === principalId) ?? null;
    const rejets = certs.filter((c) => c.statutVerification === 'REJETEE');

    // ─── Profil refusé : motif + correction ───────────────────────────────────
    if (me.statut === 'REJETE') {
        return (
            <Pressable onPress={() => router.push('/artisan-demarrage')} accessibilityRole="button">
                <View style={[styles.card, { backgroundColor: colors.dangerSoft }]}>
                    <XCircle size={19} color={palette.red700} strokeWidth={2} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.title, { color: palette.red700 }]}>
                            Profil refusé, corrigez votre dossier
                        </Text>
                        <Text
                            style={[styles.subtitle, { color: colors.textSecondary }]}
                            numberOfLines={1}
                        >
                            {me.raisonSuspension?.trim() ?? 'Touchez pour lire le motif'}
                        </Text>
                    </View>
                    <ChevronRight size={17} color={palette.red700} strokeWidth={2.2} />
                </View>
            </Pressable>
        );
    }

    // ─── Profil validé : ne rester visible que si un document a été refusé ────
    if (me.verified) {
        if (rejets.length === 0) return null;
        return (
            <Pressable onPress={() => router.push('/justificatifs')} accessibilityRole="button">
                <View style={[styles.card, { backgroundColor: colors.warningSoft }]}>
                    <FileWarning size={19} color={palette.terracotta700} strokeWidth={2} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.title, { color: palette.terracotta700 }]}>
                            {rejets.length === 1
                                ? 'Un document a été refusé'
                                : `${rejets.length} documents refusés`}
                        </Text>
                        <Text
                            style={[styles.subtitle, { color: colors.textSecondary }]}
                            numberOfLines={1}
                        >
                            Touchez pour corriger et resoumettre
                        </Text>
                    </View>
                    <ChevronRight size={17} color={palette.terracotta700} strokeWidth={2.2} />
                </View>
            </Pressable>
        );
    }

    // ─── Profil en attente : progression compacte ─────────────────────────────
    const identiteOk = identite != null && identite.statutVerification !== 'REJETEE';
    const preuveOk = preuvePrincipal != null && preuvePrincipal.statutVerification !== 'REJETEE';
    const aCorriger =
        identite?.statutVerification === 'REJETEE' ||
        preuvePrincipal?.statutVerification === 'REJETEE';
    const dossierComplet = identiteOk && preuveOk;
    const progress = dossierComplet ? 0.85 : (Number(identiteOk) + Number(preuveOk)) / 3;

    return (
        <Pressable onPress={() => router.push('/artisan-demarrage')} accessibilityRole="button">
            <LinearGradient
                colors={[palette.navy800, palette.navy900]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.card, { flexDirection: 'column', alignItems: 'stretch' }]}
            >
                <View style={styles.row}>
                    <ShieldCheck size={19} color={palette.white} strokeWidth={2} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>
                            {dossierComplet
                                ? 'Dossier en cours d\'examen (24-48 h)'
                                : 'Faites valider votre profil'}
                        </Text>
                        <Text style={styles.subtitle} numberOfLines={1}>
                            {aCorriger
                                ? 'Un document refusé est à corriger'
                                : dossierComplet
                                  ? 'Vous serez notifié dès la validation'
                                  : `Identité ${identiteOk ? '✓' : '· à envoyer'}  ·  Diplôme ${preuveOk ? '✓' : '· à envoyer'}`}
                        </Text>
                    </View>
                    <ChevronRight size={17} color="rgba(255,255,255,0.8)" strokeWidth={2.2} />
                </View>
                <View style={styles.progressTrack}>
                    <View
                        style={[
                            styles.progressFill,
                            { width: `${Math.round(progress * 100)}%` },
                            aCorriger && { backgroundColor: palette.red600 },
                        ]}
                    />
                </View>
            </LinearGradient>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: spacing.xl,
        marginBottom: spacing.md,
        borderRadius: radii.lg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        ...shadows.card,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    title: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.sm,
        color: palette.white,
        letterSpacing: -0.1,
    },
    subtitle: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 2,
        color: 'rgba(255,255,255,0.72)',
        marginTop: 1,
    },
    progressTrack: {
        height: 4,
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
});
