import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    Alert,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import {
    ArrowLeft,
    BadgeCheck,
    Check,
    ChevronLeft,
    ChevronRight,
    ContactRound,
    FileText,
    GraduationCap,
    LockOpen,
    Maximize2,
    ShieldAlert,
    Sparkles,
    Star,
    X,
} from 'lucide-react-native';
import { ApiError } from '../../lib/api';
import { suppressLock } from '../../lib/lockGuard';
import { useAuth } from '../../stores/auth';
import { ImageViewer } from '../../components/ImageViewer';
import { Button, Card, EmptyState, Skeleton } from '../../components/ui';
import {
    usePendingArtisans,
    usePendingCertifications,
    useVerifyArtisan,
    useRejectArtisan,
    useVerifyCertification,
    useUnlockCertification,
    useCheckIdentite,
    useCertificationDocMatches,
    usePendingMetiers,
    useValidateMetier,
    type AdminCertification,
    type IdentiteMatch,
    type PendingArtisan,
    type PendingMetier,
} from '../../features/admin/hooks';
import { colors, palette, spacing, typography, fontSizes, lineHeights, radii } from '../../theme/tokens';

/**
 * File de validation admin, DOSSIER PAR DOSSIER : un seul artisan à l'écran,
 * ses documents en grand format (tap = plein écran avec zoom), décision, puis
 * le dossier suivant s'affiche automatiquement. Chaque rejet exige un motif
 * que l'artisan lit dans l'app (notification envoyée à chaque décision).
 */

type RejetCible =
    | { kind: 'artisan'; id: string; nom: string }
    | { kind: 'certification'; id: string; nom: string };

export default function ValidationsScreen() {
    const router = useRouter();
    const isAdmin = useAuth((s) => s.status === 'authenticated' && s.user?.role === 'ADMIN');

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
                <Text style={styles.title}>Validations</Text>
                <View style={{ width: 38 }} />
            </View>
            {!isAdmin ? (
                <EmptyState
                    icon={<ShieldAlert size={30} color={colors.textMuted} strokeWidth={1.6} />}
                    title="Accès réservé"
                    message="Cet espace est réservé aux administrateurs de la plateforme."
                />
            ) : (
                <ValidationsContent />
            )}
        </SafeAreaView>
    );
}

function ValidationsContent() {
    const { data: artisans, isLoading, refetch, isRefetching } = usePendingArtisans();
    const { data: certifications, refetch: refetchCerts } = usePendingCertifications();
    const { data: pendingMetiers, refetch: refetchMetiers } = usePendingMetiers();
    const validateMetier = useValidateMetier();
    const verifyArtisan = useVerifyArtisan();
    const rejectArtisan = useRejectArtisan();
    const verifyCertification = useVerifyCertification();
    const unlockCertification = useUnlockCertification();

    // Loaders CIBLÉS : seul le bouton de l'action en cours tourne
    const artisanValidating = (id: string) =>
        verifyArtisan.isPending && verifyArtisan.variables === id;
    const documentValidating = (id: string) =>
        verifyCertification.isPending &&
        verifyCertification.variables?.certificationId === id &&
        verifyCertification.variables?.verifie === true;
    const documentUnlocking = (id: string) =>
        unlockCertification.isPending && unlockCertification.variables === id;

    const deverrouiller = (c: AdminCertification) => {
        Alert.alert(
            'Déverrouiller ce document ?',
            `« ${c.titre} » repassera en attente d'examen et l'artisan pourra le modifier. Il sera notifié.`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Déverrouiller',
                    onPress: () =>
                        unlockCertification.mutate(c.id, {
                            onError: (e) => erreur(e, 'Déverrouillage impossible'),
                        }),
                },
            ],
        );
    };

    const [imageUri, setImageUri] = useState<string | null>(null);
    const [rejet, setRejet] = useState<RejetCible | null>(null);
    const [motif, setMotif] = useState('');
    const [indexBrut, setIndexBrut] = useState(0);

    const dossiers = artisans ?? [];
    // Après une décision, le dossier disparaît de la file : on reste calé
    const index = dossiers.length === 0 ? 0 : Math.min(indexBrut, dossiers.length - 1);
    const dossier = dossiers[index];

    const pendingIds = new Set(dossiers.map((a) => a.id));
    const autresDocuments = (certifications ?? []).filter(
        (c) => !c.artisan || !pendingIds.has(c.artisan.id),
    );

    /** Images en plein écran (zoom) ; PDF dans le navigateur */
    const ouvrirDocument = (url: string | null | undefined) => {
        if (!url) {
            Alert.alert(
                'Document en préparation',
                'Le fichier est en cours de traitement, réessayez dans quelques secondes.',
            );
            return;
        }
        if (url.toLowerCase().endsWith('.pdf')) {
            suppressLock(); // le navigateur met l'app en arrière-plan
            void WebBrowser.openBrowserAsync(url);
        } else {
            setImageUri(url);
        }
    };

    const erreur = (e: unknown, titre: string) =>
        Alert.alert(titre, e instanceof ApiError ? e.message : 'Réessayez.');

    const validerArtisan = (artisan: PendingArtisan) => {
        const nom =
            artisan.nomEntreprise ??
            `${artisan.user.prenom ?? ''} ${artisan.user.nom ?? ''}`.trim();
        Alert.alert(
            'Valider cet artisan ?',
            `${nom} deviendra visible de tous les clients et sera notifié immédiatement.`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Valider',
                    onPress: () =>
                        verifyArtisan.mutate(artisan.id, {
                            onError: (e) => erreur(e, 'Validation impossible'),
                        }),
                },
            ],
        );
    };

    const validerMetier = (m: PendingMetier) => {
        Alert.alert(
            'Valider ce métier ?',
            `« ${m.nom} » (${m.categorie.nom}) deviendra visible de tous les clients et sélectionnable par les artisans.`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Valider',
                    onPress: () =>
                        validateMetier.mutate(m.id, {
                            onError: (e) => erreur(e, 'Validation impossible'),
                        }),
                },
            ],
        );
    };

    const validerDocument = (
        certification: AdminCertification,
        extra?: { numeroPiece?: string },
    ) => {
        verifyCertification.mutate(
            {
                certificationId: certification.id,
                verifie: true,
                numeroPiece: extra?.numeroPiece,
            },
            { onError: (e) => erreur(e, 'Validation impossible') },
        );
    };

    const confirmerRejet = () => {
        if (!rejet) return;
        if (motif.trim().length < 5) {
            Alert.alert(
                'Motif requis',
                'Écrivez un motif clair : l\'artisan le lira pour corriger son dossier.',
            );
            return;
        }
        const raison = motif.trim();
        const onDone = () => {
            setRejet(null);
            setMotif('');
        };
        if (rejet.kind === 'artisan') {
            rejectArtisan.mutate(
                { artisanId: rejet.id, raison },
                { onSuccess: onDone, onError: (e) => erreur(e, 'Rejet impossible') },
            );
        } else {
            verifyCertification.mutate(
                { certificationId: rejet.id, verifie: false, raison },
                { onSuccess: onDone, onError: (e) => erreur(e, 'Rejet impossible') },
            );
        }
    };

    if (isLoading && !artisans) {
        return (
            <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
                <Skeleton height={60} borderRadius={radii.lg} />
                <Skeleton height={420} borderRadius={radii.lg} />
            </View>
        );
    }

    const busy =
        verifyArtisan.isPending || rejectArtisan.isPending || verifyCertification.isPending;

    return (
        <>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={() => {
                            void refetch();
                            void refetchCerts();
                            void refetchMetiers();
                        }}
                        tintColor={colors.primary}
                    />
                }
            >
                {/* Pagination des dossiers */}
                {dossiers.length > 0 && dossier ? (
                    <>
                        <View style={styles.pager}>
                            <Pressable
                                onPress={() => setIndexBrut(Math.max(0, index - 1))}
                                disabled={index === 0}
                                style={[styles.pagerButton, index === 0 && { opacity: 0.3 }]}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel="Dossier précédent"
                            >
                                <ChevronLeft size={18} color={colors.text} strokeWidth={2.2} />
                            </Pressable>
                            <View style={{ flex: 1, alignItems: 'center' }}>
                                <Text style={styles.pagerText}>
                                    Dossier {index + 1} sur {dossiers.length}
                                </Text>
                                <View style={styles.pagerTrack}>
                                    <View
                                        style={[
                                            styles.pagerFill,
                                            { width: `${((index + 1) / dossiers.length) * 100}%` },
                                        ]}
                                    />
                                </View>
                            </View>
                            <Pressable
                                onPress={() =>
                                    setIndexBrut(Math.min(dossiers.length - 1, index + 1))
                                }
                                disabled={index >= dossiers.length - 1}
                                style={[
                                    styles.pagerButton,
                                    index >= dossiers.length - 1 && { opacity: 0.3 },
                                ]}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel="Dossier suivant"
                            >
                                <ChevronRight size={18} color={colors.text} strokeWidth={2.2} />
                            </Pressable>
                        </View>

                        <Dossier
                            artisan={dossier}
                            busy={busy}
                            validerLoading={artisanValidating(dossier.id)}
                            documentValidating={documentValidating}
                            documentUnlocking={documentUnlocking}
                            onDeverrouillerDocument={deverrouiller}
                            onOpenDocument={ouvrirDocument}
                            onValiderDocument={validerDocument}
                            onRejeterDocument={(c) =>
                                setRejet({ kind: 'certification', id: c.id, nom: c.titre })
                            }
                            onValider={() => validerArtisan(dossier)}
                            onRejeter={() =>
                                setRejet({
                                    kind: 'artisan',
                                    id: dossier.id,
                                    nom:
                                        dossier.nomEntreprise ??
                                        `${dossier.user.prenom ?? ''} ${dossier.user.nom ?? ''}`.trim(),
                                })
                            }
                        />
                    </>
                ) : (
                    <EmptyState
                        icon={<BadgeCheck size={30} color={palette.green600} strokeWidth={1.6} />}
                        title="Aucun dossier artisan en attente"
                        message={
                            autresDocuments.length > 0
                                ? 'Il reste des documents d\'artisans actifs à examiner ci-dessous.'
                                : 'Tout est à jour.'
                        }
                    />
                )}

                {/* Documents envoyés par des artisans déjà actifs */}
                {autresDocuments.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>
                            Documents d'artisans déjà actifs ({autresDocuments.length})
                        </Text>
                        {autresDocuments.map((c) => (
                            <Card key={c.id} style={{ gap: spacing.sm }}>
                                {!!c.artisan && (
                                    <Text style={styles.docOwner}>
                                        {c.artisan.nomEntreprise ??
                                            `${c.artisan.user?.prenom ?? ''} ${c.artisan.user?.nom ?? ''}`.trim()}
                                    </Text>
                                )}
                                <GrandDocument
                                    certification={c}
                                    metierNom={null}
                                    busy={busy}
                                    validerLoading={documentValidating(c.id)}
                                    excludeArtisanId={c.artisan?.id}
                                    onOpen={() => ouvrirDocument(c.documentUrl)}
                                    onValider={(extra) => validerDocument(c, extra)}
                                    onRejeter={() =>
                                        setRejet({ kind: 'certification', id: c.id, nom: c.titre })
                                    }
                                />
                            </Card>
                        ))}
                    </>
                )}

                {/* Métiers suggérés par des artisans, à valider */}
                {(pendingMetiers?.length ?? 0) > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>
                            Métiers suggérés ({pendingMetiers!.length})
                        </Text>
                        {pendingMetiers!.map((m) => {
                            const nbArtisans = m._count?.artisanMetiers ?? 0;
                            return (
                                <Card key={m.id} style={styles.metierSuggereCard}>
                                    <View style={styles.metierSuggereIcon}>
                                        <Sparkles
                                            size={16}
                                            color={colors.primary}
                                            strokeWidth={2.2}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.metierSuggereNom} numberOfLines={2}>
                                            {m.nom}
                                        </Text>
                                        <Text style={styles.metierSuggereMeta} numberOfLines={1}>
                                            {m.categorie.nom}
                                            {nbArtisans > 0
                                                ? ` · ${nbArtisans} artisan${nbArtisans > 1 ? 's' : ''}`
                                                : ''}
                                        </Text>
                                    </View>
                                    <Button
                                        title="Valider"
                                        size="sm"
                                        icon={
                                            <Check
                                                size={14}
                                                color={colors.onPrimary}
                                                strokeWidth={2.6}
                                            />
                                        }
                                        loading={
                                            validateMetier.isPending &&
                                            validateMetier.variables === m.id
                                        }
                                        disabled={validateMetier.isPending}
                                        onPress={() => validerMetier(m)}
                                    />
                                </Card>
                            );
                        })}
                    </>
                )}
            </ScrollView>

            {/* Visionneuse plein écran (pincer pour zoomer) */}
            <ImageViewer uri={imageUri} visible={imageUri != null} onClose={() => setImageUri(null)} />

            {/* Motif de rejet : lu par l'artisan pour corriger */}
            <Modal
                visible={rejet != null}
                transparent
                animationType="fade"
                onRequestClose={() => setRejet(null)}
            >
                <KeyboardAvoidingView
                    style={styles.modalBackdrop}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Rejeter « {rejet?.nom} »</Text>
                        <Text style={styles.modalText}>
                            L'artisan recevra une notification avec ce motif pour corriger et
                            resoumettre.
                        </Text>
                        <TextInput
                            value={motif}
                            onChangeText={setMotif}
                            placeholder="Ex. : document illisible, refaites la photo à plat et bien éclairée"
                            placeholderTextColor={colors.textMuted}
                            style={styles.modalInput}
                            multiline
                            maxLength={500}
                            autoFocus
                        />
                        <Button
                            title="Rejeter avec ce motif"
                            fullWidth
                            variant="danger"
                            loading={rejectArtisan.isPending || verifyCertification.isPending}
                            onPress={confirmerRejet}
                        />
                        <Button
                            title="Annuler"
                            variant="ghost"
                            fullWidth
                            onPress={() => {
                                setRejet(null);
                                setMotif('');
                            }}
                        />
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </>
    );
}

/** Un dossier artisan complet : identité, documents en grand, décision */
function Dossier({
    artisan,
    busy,
    validerLoading,
    documentValidating,
    documentUnlocking,
    onDeverrouillerDocument,
    onOpenDocument,
    onValiderDocument,
    onRejeterDocument,
    onValider,
    onRejeter,
}: {
    artisan: PendingArtisan;
    busy: boolean;
    validerLoading: boolean;
    documentValidating: (id: string) => boolean;
    documentUnlocking: (id: string) => boolean;
    onDeverrouillerDocument: (c: AdminCertification) => void;
    onOpenDocument: (url: string | null | undefined) => void;
    onValiderDocument: (c: AdminCertification, extra?: { numeroPiece?: string }) => void;
    onRejeterDocument: (c: AdminCertification) => void;
    onValider: () => void;
    onRejeter: () => void;
}) {
    const nom =
        artisan.nomEntreprise ?? `${artisan.user.prenom ?? ''} ${artisan.user.nom ?? ''}`.trim();
    const identite = artisan.certifications.find((c) => c.type === 'IDENTITE');
    const diplomes = artisan.certifications.filter((c) => c.type !== 'IDENTITE');
    const metierNom = (metierId?: string | null) =>
        artisan.metiers.find((m) => m.metierId === metierId)?.metier.nom ?? null;

    const principal = artisan.metiers.find((m) => m.estPrincipal);
    const identiteValidee = identite?.statutVerification === 'VALIDEE';
    const preuveValidee = diplomes.some(
        (c) => c.metierId === principal?.metierId && c.statutVerification === 'VALIDEE',
    );
    const dossierPret = identiteValidee && preuveValidee;
    const documents = [...(identite ? [identite] : []), ...diplomes];

    return (
        <View style={{ gap: spacing.md }}>
            {/* Identité du dossier */}
            <Card>
                <Text style={styles.artisanNom}>{nom || artisan.user.email}</Text>
                <Text style={styles.artisanMeta}>
                    {artisan.villePrincipale} · inscrit le{' '}
                    {new Date(artisan.createdAt).toLocaleDateString('fr-FR')}
                    {artisan.user.telephone ? ` · ${artisan.user.telephone}` : ''}
                </Text>
                <View style={styles.metierRow}>
                    {artisan.metiers.map((m) => (
                        <View key={m.id} style={styles.metierChip}>
                            {m.estPrincipal && (
                                <Star size={11} color="#F59E0B" fill="#F59E0B" strokeWidth={0} />
                            )}
                            <Text style={styles.metierChipText}>{m.metier.nom}</Text>
                        </View>
                    ))}
                </View>
                {!!artisan.bio && (
                    <Text style={styles.bio} numberOfLines={3}>
                        {artisan.bio}
                    </Text>
                )}
            </Card>

            {/* Documents en grand format */}
            {documents.length === 0 ? (
                <Text style={styles.aucunDoc}>
                    Aucun document envoyé : l'artisan doit fournir sa pièce d'identité et la preuve
                    de son métier principal avant validation.
                </Text>
            ) : (
                documents.map((c) => (
                    <GrandDocument
                        key={c.id}
                        certification={c}
                        metierNom={c.type === 'IDENTITE' ? null : metierNom(c.metierId)}
                        busy={busy}
                        validerLoading={documentValidating(c.id)}
                        deverrouillerLoading={documentUnlocking(c.id)}
                        excludeArtisanId={artisan.id}
                        onOpen={() => onOpenDocument(c.documentUrl)}
                        onValider={(extra) => onValiderDocument(c, extra)}
                        onRejeter={() => onRejeterDocument(c)}
                        onDeverrouiller={() => onDeverrouillerDocument(c)}
                    />
                ))
            )}

            {/* Décision finale — la règle : identité + métier principal validés */}
            {dossierPret ? (
                <Text style={styles.pretText}>
                    ✓ Identité et métier principal approuvés : le profil peut être validé.
                </Text>
            ) : (
                <Text style={styles.pasPretText}>
                    Pour activer ce profil : validez d'abord la pièce d'identité et la preuve du
                    métier principal ci-dessus. Les métiers secondaires sont optionnels.
                </Text>
            )}
            <View style={styles.actionsRow}>
                <Button
                    title="Rejeter le dossier"
                    variant="ghost"
                    onPress={onRejeter}
                    disabled={busy}
                    style={{ flex: 1 }}
                />
                <Button
                    title="Valider l'artisan"
                    onPress={onValider}
                    disabled={busy || !dossierPret}
                    loading={validerLoading}
                    style={{ flex: 1 }}
                />
            </View>
        </View>
    );
}

/** Document plein format : aperçu large tappable + décision dessous */
function GrandDocument({
    certification: c,
    metierNom,
    busy,
    validerLoading,
    deverrouillerLoading,
    excludeArtisanId,
    onOpen,
    onValider,
    onRejeter,
    onDeverrouiller,
}: {
    certification: AdminCertification;
    metierNom: string | null;
    busy: boolean;
    validerLoading: boolean;
    deverrouillerLoading?: boolean;
    excludeArtisanId?: string;
    onOpen: () => void;
    onValider: (extra?: { numeroPiece?: string }) => void;
    onRejeter: () => void;
    onDeverrouiller?: () => void;
}) {
    const estImage = !!c.documentUrl && !c.documentUrl.toLowerCase().endsWith('.pdf');
    const statut = c.statutVerification;
    const isIdentite = c.type === 'IDENTITE';

    // Anti-doublon (pièce d'identité) : le validateur saisit le n° lu sur la
    // pièce ; on interroge l'index (hashes) pour repérer un compte réutilisant
    // la même identité, puis le n° est indexé à la validation.
    const [numero, setNumero] = useState('');
    const [matches, setMatches] = useState<IdentiteMatch[] | null>(null);
    const checkIdentite = useCheckIdentite();
    // Détection AUTOMATIQUE : l'image de la pièce a-t-elle déjà été soumise ?
    const docMatches = useCertificationDocMatches(c.id, isIdentite && statut !== 'VALIDEE');
    const lancerVerif = () => {
        if (numero.trim().length < 4) {
            Alert.alert('Numéro requis', 'Saisissez le numéro de la pièce (au moins 4 caractères).');
            return;
        }
        checkIdentite.mutate(
            { numeroPiece: numero.trim(), excludeArtisanId },
            { onSuccess: (m) => setMatches(m), onError: () => setMatches(null) },
        );
    };

    return (
        <Card style={{ gap: spacing.sm, padding: spacing.md }}>
            {/* En-tête du document */}
            <View style={styles.docTitleRow}>
                {c.type === 'IDENTITE' ? (
                    <ContactRound size={15} color={colors.primary} strokeWidth={2.2} />
                ) : (
                    <GraduationCap size={15} color={colors.accent} strokeWidth={2.2} />
                )}
                <Text style={styles.docTitle} numberOfLines={1}>
                    {c.titre}
                </Text>
                {statut === 'VALIDEE' && (
                    <Text style={[styles.docBadge, { color: palette.green700 }]}>Validé ✓</Text>
                )}
                {statut === 'REJETEE' && (
                    <Text style={[styles.docBadge, { color: palette.red700 }]}>Rejeté</Text>
                )}
            </View>
            <Text style={styles.docMeta} numberOfLines={1}>
                {c.type === 'IDENTITE' ? 'Pièce d\'identité' : (metierNom ?? 'Métier non précisé')}
                {c.organisme ? ` · ${c.organisme}` : ''}
            </Text>

            {/* Aperçu GRAND format : tout l'aperçu est tappable */}
            <Pressable
                onPress={onOpen}
                accessibilityRole="button"
                accessibilityLabel="Voir le document en plein écran"
            >
                {estImage && c.documentUrl ? (
                    <View>
                        <Image
                            source={{ uri: c.documentUrl }}
                            style={styles.docPreview}
                            contentFit="cover"
                            transition={150}
                        />
                        <View style={styles.zoomBadge}>
                            <Maximize2 size={14} color={palette.white} strokeWidth={2.2} />
                            <Text style={styles.zoomBadgeText}>Plein écran</Text>
                        </View>
                    </View>
                ) : (
                    <View style={[styles.docPreview, styles.docPreviewEmpty]}>
                        <FileText
                            size={30}
                            color={c.documentUrl ? colors.primary : colors.textMuted}
                            strokeWidth={1.8}
                        />
                        <Text style={styles.docPreviewText}>
                            {c.documentUrl
                                ? 'PDF : toucher pour ouvrir'
                                : 'Document en cours de traitement…'}
                        </Text>
                    </View>
                )}
            </Pressable>

            {statut === 'REJETEE' && !!c.raisonRejet && (
                <Text style={styles.rejetText}>Motif envoyé : {c.raisonRejet}</Text>
            )}

            {/* Document validé = verrouillé pour l'artisan : l'admin peut le
                déverrouiller (sur demande) pour autoriser une modification */}
            {statut === 'VALIDEE' && onDeverrouiller && (
                <Button
                    title="Déverrouiller (autoriser la modification)"
                    variant="ghost"
                    size="sm"
                    icon={<LockOpen size={14} color={colors.text} strokeWidth={2.2} />}
                    onPress={onDeverrouiller}
                    disabled={busy && !deverrouillerLoading}
                    loading={deverrouillerLoading}
                    fullWidth
                />
            )}

            {/* Anti-doublon AUTOMATIQUE : image de la pièce déjà soumise ? */}
            {isIdentite && statut !== 'VALIDEE' && (docMatches.data?.length ?? 0) > 0 && (
                <View style={styles.identiteWarn}>
                    <ShieldAlert size={15} color={palette.red700} strokeWidth={2.2} />
                    <Text style={styles.identiteWarnTxt}>
                        ⚠️ Image déjà soumise par {docMatches.data!.length} autre
                        {docMatches.data!.length > 1 ? 's' : ''} compte
                        {docMatches.data!.length > 1 ? 's' : ''} (
                        {docMatches.data!.some((m) => m.motif === 'image_exacte')
                            ? 'fichier identique'
                            : 'image très ressemblante'}
                        ) : {docMatches.data!.map((m) => m.nomApercu ?? 'compte').join(', ')}.
                        Vérifiez avant de valider.
                    </Text>
                </View>
            )}

            {/* Anti-doublon : cette identité correspond-elle à un autre compte ? */}
            {isIdentite && statut !== 'VALIDEE' && (
                <View style={styles.identiteBox}>
                    <View style={styles.identiteRow}>
                        <TextInput
                            style={styles.identiteInput}
                            placeholder="N° pièce d'identité (lu sur le document)"
                            placeholderTextColor={colors.textMuted}
                            value={numero}
                            onChangeText={(v) => {
                                setNumero(v);
                                setMatches(null);
                            }}
                            autoCapitalize="characters"
                            autoCorrect={false}
                        />
                        <Button
                            title="Vérifier"
                            size="sm"
                            variant="secondary"
                            loading={checkIdentite.isPending}
                            onPress={lancerVerif}
                        />
                    </View>
                    {matches != null &&
                        (matches.length === 0 ? (
                            <Text style={styles.identiteOk}>
                                ✓ Aucun doublon connu pour ce numéro.
                            </Text>
                        ) : (
                            <View style={styles.identiteWarn}>
                                <ShieldAlert size={15} color={palette.red700} strokeWidth={2.2} />
                                <Text style={styles.identiteWarnTxt}>
                                    ⚠️ Déjà enregistré sur {matches.length} autre
                                    {matches.length > 1 ? 's' : ''} compte
                                    {matches.length > 1 ? 's' : ''} :{' '}
                                    {matches
                                        .map(
                                            (m) =>
                                                `${m.nomApercu ?? 'compte'}${m.numeroApercu ? ` (${m.numeroApercu})` : ''}`,
                                        )
                                        .join(', ')}
                                    . Vérifiez avant de valider.
                                </Text>
                            </View>
                        ))}
                    <Text style={styles.identiteHint}>
                        Le numéro n'est pas stocké en clair : seule une empreinte (hash) sert à
                        détecter les doublons.
                    </Text>
                </View>
            )}

            {/* Décision sur CE document */}
            {statut !== 'VALIDEE' && (
                <View style={styles.actionsRow}>
                    {statut !== 'REJETEE' && (
                        <Button
                            title="Rejeter"
                            variant="ghost"
                            size="sm"
                            icon={<X size={14} color={colors.text} strokeWidth={2.4} />}
                            onPress={onRejeter}
                            disabled={busy}
                            style={{ flex: 1 }}
                        />
                    )}
                    <Button
                        title="Valider ce document"
                        variant="secondary"
                        size="sm"
                        icon={<Check size={14} color={colors.primary} strokeWidth={2.6} />}
                        onPress={() =>
                            onValider(
                                isIdentite
                                    ? { numeroPiece: numero.trim() || undefined }
                                    : undefined,
                            )
                        }
                        disabled={busy && !validerLoading}
                        loading={validerLoading}
                        style={{ flex: 2 }}
                    />
                </View>
            )}
        </Card>
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
        gap: spacing.md,
    },
    sectionTitle: {
        fontFamily: typography.heading,
        fontSize: fontSizes.base,
        color: colors.text,
        marginTop: spacing.sm,
    },
    pager: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    pagerButton: {
        width: 34,
        height: 34,
        borderRadius: radii.full,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pagerText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    pagerTrack: {
        alignSelf: 'stretch',
        height: 4,
        borderRadius: radii.full,
        backgroundColor: colors.border,
        overflow: 'hidden',
    },
    pagerFill: {
        height: '100%',
        borderRadius: radii.full,
        backgroundColor: colors.primary,
    },
    artisanNom: {
        fontFamily: typography.heading,
        fontSize: fontSizes.md,
        color: colors.text,
        letterSpacing: -0.2,
    },
    artisanMeta: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    metierRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
        marginTop: spacing.sm,
    },
    metierChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radii.full,
        backgroundColor: colors.surfaceMuted,
    },
    metierChipText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs - 1,
        color: colors.textSecondary,
    },
    bio: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 4,
        color: colors.textSecondary,
        marginTop: spacing.sm,
    },
    aucunDoc: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 3,
        color: palette.terracotta700,
        backgroundColor: colors.warningSoft,
        borderRadius: radii.md,
        padding: spacing.md,
    },
    docTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    docTitle: {
        flex: 1,
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    docBadge: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.xs,
    },
    docMeta: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
    docPreview: {
        width: '100%',
        height: 220,
        borderRadius: radii.md,
        backgroundColor: colors.surfaceMuted,
    },
    docPreviewEmpty: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
    },
    docPreviewText: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
    zoomBadge: {
        position: 'absolute',
        right: spacing.sm,
        bottom: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(15,23,42,0.65)',
        borderRadius: radii.full,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
    },
    zoomBadgeText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
        color: palette.white,
    },
    rejetText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 3,
        color: palette.red700,
    },
    pretText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
        color: palette.green700,
        backgroundColor: colors.successSoft,
        borderRadius: radii.md,
        padding: spacing.sm,
    },
    pasPretText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 3,
        color: palette.terracotta700,
        backgroundColor: colors.warningSoft,
        borderRadius: radii.md,
        padding: spacing.sm,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    identiteBox: {
        gap: spacing.sm,
        backgroundColor: colors.surfaceMuted,
        borderRadius: radii.md,
        padding: spacing.sm,
    },
    identiteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    identiteInput: {
        flex: 1,
        height: 40,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    identiteOk: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
        color: palette.green700,
    },
    identiteWarn: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.xs,
        backgroundColor: colors.dangerSoft,
        borderRadius: radii.md,
        padding: spacing.sm,
    },
    identiteWarnTxt: {
        flex: 1,
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 3,
        color: palette.red700,
    },
    identiteHint: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs - 1,
        color: colors.textMuted,
    },
    docOwner: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
    metierSuggereCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
    },
    metierSuggereIcon: {
        width: 34,
        height: 34,
        borderRadius: radii.full,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    metierSuggereNom: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    metierSuggereMeta: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
    },
    modalCard: {
        backgroundColor: colors.surface,
        borderRadius: radii.xl,
        padding: spacing.xl,
        gap: spacing.md,
    },
    modalTitle: {
        fontFamily: typography.heading,
        fontSize: fontSizes.md,
        color: colors.text,
    },
    modalText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 3,
        color: colors.textSecondary,
    },
    modalInput: {
        minHeight: 80,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        padding: spacing.md,
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.text,
        textAlignVertical: 'top',
    },
});
