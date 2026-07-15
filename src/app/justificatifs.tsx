import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
    ArrowLeft,
    BadgeCheck,
    CalendarDays,
    ChevronRight,
    Clock4,
    ContactRound,
    FileText,
    ImagePlus,
    Images,
    Lock,
    Plus,
    RefreshCw,
    ShieldCheck,
    Star,
    Trash2,
    XCircle,
} from 'lucide-react-native';
import { ApiError } from '../lib/api';
import { suppressLock } from '../lib/lockGuard';
import { useAuth } from '../stores/auth';
import { LoginInvite } from '../components/LoginInvite';
import { Button, Input, Card, Skeleton } from '../components/ui';
import {
    useMyArtisanProfile,
    useMyCertifications,
    useAddCertification,
    useReplaceCertificationDocument,
    useDeleteCertification,
    usePortfolio,
    type LocalDocument,
} from '../features/artisan/hooks';
import type { Certification } from '../types/api';
import { colors, palette, spacing, typography, fontSizes, lineHeights, radii } from '../theme/tokens';

/**
 * Vérification de l'artisan, en deux étapes claires :
 *   1. IDENTITÉ  — une pièce d'identité (obligatoire, jamais montrée aux clients)
 *   2. MÉTIERS   — diplômes/attestations par métier : preuve exigée pour le
 *      métier principal, optionnelle pour les secondaires (jugés par l'admin)
 */

const MAX_DOC_MB = 10;

export default function JustificatifsScreen() {
    const status = useAuth((s) => s.status);
    const isArtisan = useAuth((s) => s.user?.role === 'ARTISAN');
    const router = useRouter();

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
                <Text style={styles.title}>Vérification du profil</Text>
                <View style={{ width: 38 }} />
            </View>
            {status !== 'authenticated' || !isArtisan ? (
                <LoginInvite
                    title="Espace artisan"
                    message="Connectez-vous avec un compte artisan pour gérer vos justificatifs."
                />
            ) : (
                <JustificatifsContent />
            )}
        </SafeAreaView>
    );
}

/** Choisit une photo (galerie) ou un PDF et renvoie un fichier prêt à l'envoi */
async function pickDocument(kind: 'photo' | 'pdf'): Promise<LocalDocument | null> {
    suppressLock(); // le sélecteur met l'app en arrière-plan : pas d'empreinte au retour
    if (kind === 'photo') {
        const picked = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
        });
        if (picked.canceled || !picked.assets?.[0]) return null;
        const asset = picked.assets[0];
        return {
            uri: asset.uri,
            name: asset.fileName ?? 'justificatif.jpg',
            mimeType: asset.mimeType ?? 'image/jpeg',
        };
    }
    const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return null;
    const asset = picked.assets[0];
    if (asset.size != null && asset.size > MAX_DOC_MB * 1024 * 1024) {
        Alert.alert('Fichier trop lourd', `Le document doit faire moins de ${MAX_DOC_MB} Mo.`);
        return null;
    }
    return {
        uri: asset.uri,
        name: asset.name ?? 'justificatif.pdf',
        mimeType: asset.mimeType ?? 'application/pdf',
    };
}

function StatutChip({ certification }: { certification: Certification }) {
    const statut = certification.statutVerification ?? (certification.verifie ? 'VALIDEE' : 'EN_ATTENTE');
    if (statut === 'VALIDEE') {
        return (
            <View style={styles.chipRow}>
                <BadgeCheck size={13} color={palette.green700} strokeWidth={2.4} />
                <Text style={[styles.chipText, { color: palette.green700 }]}>Vérifié</Text>
            </View>
        );
    }
    if (statut === 'REJETEE') {
        return (
            <View style={{ gap: 2 }}>
                <View style={styles.chipRow}>
                    <XCircle size={13} color={palette.red600} strokeWidth={2.4} />
                    <Text style={[styles.chipText, { color: palette.red700 }]}>Refusé</Text>
                </View>
                <Text style={styles.rejetText}>
                    {certification.raisonRejet?.trim()
                        ? `Motif : ${certification.raisonRejet.trim()}`
                        : 'Document illisible ou non conforme.'}
                    {' '}Remplacez le document pour resoumettre.
                </Text>
            </View>
        );
    }
    return (
        <View style={styles.chipRow}>
            <Clock4 size={13} color={palette.amber600} strokeWidth={2.4} />
            <Text style={[styles.chipText, { color: palette.terracotta700 }]}>
                En attente d'examen
            </Text>
        </View>
    );
}

function JustificatifsContent() {
    const router = useRouter();
    const { data: me } = useMyArtisanProfile();
    const { data: portfolio } = usePortfolio(me?.id);
    const { data: certifications, isLoading } = useMyCertifications();
    const addCertification = useAddCertification();
    const replaceDocument = useReplaceCertificationDocument();
    const deleteCertification = useDeleteCertification();

    // Formulaire « preuve de métier » : ouvert pour un métier précis
    const [formTarget, setFormTarget] = useState<{ metierId: string; nom: string } | null>(null);
    const [titre, setTitre] = useState('');
    const [organisme, setOrganisme] = useState('');
    const [dateObtention, setDateObtention] = useState<Date | null>(null);
    const [showCalendar, setShowCalendar] = useState(false);
    const [document, setDocument] = useState<LocalDocument | null>(null);
    const [identiteEnvoi, setIdentiteEnvoi] = useState(false);

    const identite = (certifications ?? []).find((c) => c.type === 'IDENTITE') ?? null;
    const preuvesMetier = (certifications ?? []).filter((c) => c.type !== 'IDENTITE');
    // Documents envoyés avant le rattachement par métier : toujours visibles
    const orphelines = preuvesMetier.filter(
        (c) => !c.metierId || !(me?.metiers ?? []).some((m) => m.metier.id === c.metierId),
    );

    // Avancement du dossier : identité + preuve du métier principal
    const principalId = (me?.metiers ?? []).find((m) => m.estPrincipal)?.metier.id;
    const identiteOk = identite != null && identite.statutVerification !== 'REJETEE';
    const preuvePrincipaleOk = preuvesMetier.some(
        (c) => c.metierId === principalId && c.statutVerification !== 'REJETEE',
    );
    const dossierComplet = identiteOk && preuvePrincipaleOk;
    const metiers = [...(me?.metiers ?? [])].sort(
        (a, b) => Number(b.estPrincipal) - Number(a.estPrincipal),
    );

    const resetForm = () => {
        setTitre('');
        setOrganisme('');
        setDateObtention(null);
        setDocument(null);
        setFormTarget(null);
    };

    // ─── Étape 1 : identité (aucun formulaire, juste le document) ─────────────
    const envoyerIdentite = async (kind: 'photo' | 'pdf') => {
        const doc = await pickDocument(kind);
        if (!doc) return;
        setIdentiteEnvoi(true);
        addCertification.mutate(
            { titre: 'Pièce d\'identité', type: 'IDENTITE', document: doc },
            {
                onSettled: () => setIdentiteEnvoi(false),
                onSuccess: () =>
                    Alert.alert(
                        'Pièce d\'identité envoyée ✓',
                        'Elle sera examinée par notre équipe. Elle n\'est jamais montrée aux clients.',
                    ),
                onError: (e) =>
                    Alert.alert(
                        'Envoi impossible',
                        e instanceof ApiError ? e.message : 'Réessayez plus tard.',
                    ),
            },
        );
    };

    // ─── Étape 2 : preuve de métier ────────────────────────────────────────────
    const submitPreuve = () => {
        if (!formTarget) return;
        if (!titre.trim()) {
            Alert.alert('Titre requis', 'Ex. : CAP Plomberie, Attestation de formation…');
            return;
        }
        if (!document) {
            Alert.alert(
                'Document requis',
                'Ajoutez la photo ou le PDF du diplôme : c\'est lui qui permet la vérification.',
            );
            return;
        }
        addCertification.mutate(
            {
                titre: titre.trim(),
                organisme: organisme.trim() || undefined,
                dateObtention: dateObtention
                    ? dateObtention.toISOString().slice(0, 10)
                    : undefined,
                type: 'METIER',
                metierId: formTarget.metierId,
                document,
            },
            {
                onSuccess: () => {
                    resetForm();
                    Alert.alert(
                        'Preuve envoyée ✓',
                        'Notre équipe va l\'examiner. Vous serez notifié dès sa validation.',
                    );
                },
                onError: (e) =>
                    Alert.alert(
                        'Envoi impossible',
                        e instanceof ApiError ? e.message : 'Réessayez plus tard.',
                    ),
            },
        );
    };

    const onReplaceDocument = async (certification: Certification) => {
        const doc = await pickDocument('photo');
        if (!doc) return;
        replaceDocument.mutate(
            { certificationId: certification.id, document: doc },
            {
                onSuccess: () =>
                    Alert.alert(
                        'Document remplacé',
                        'Le justificatif repasse en attente de vérification.',
                    ),
                onError: (e) =>
                    Alert.alert(
                        'Remplacement impossible',
                        e instanceof ApiError ? e.message : 'Réessayez.',
                    ),
            },
        );
    };

    const onDelete = (certification: Certification) => {
        Alert.alert('Supprimer ce justificatif ?', certification.titre, [
            { text: 'Annuler', style: 'cancel' },
            {
                text: 'Supprimer',
                style: 'destructive',
                onPress: () => deleteCertification.mutate(certification.id),
            },
        ]);
    };

    const verifie = me?.verified === true;

    if (isLoading && !certifications) {
        return (
            <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
                <Skeleton height={90} borderRadius={radii.lg} />
                <Skeleton height={120} borderRadius={radii.lg} />
                <Skeleton height={120} borderRadius={radii.lg} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {/* Statut global */}
                {verifie ? (
                    <Card style={[styles.statusCard, { backgroundColor: colors.successSoft }]}>
                        <ShieldCheck size={22} color={palette.green700} strokeWidth={2.2} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.statusTitle, { color: palette.green700 }]}>
                                Profil vérifié
                            </Text>
                            <Text style={styles.statusText}>
                                Votre badge de confiance est visible par les clients.
                            </Text>
                        </View>
                    </Card>
                ) : me?.statut === 'REJETE' ? (
                    <Card style={[styles.statusCard, { backgroundColor: colors.dangerSoft }]}>
                        <XCircle size={22} color={palette.red700} strokeWidth={2.2} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.statusTitle, { color: palette.red700 }]}>
                                Dossier refusé
                            </Text>
                            <Text style={styles.statusText}>
                                {me.raisonSuspension?.trim()
                                    ? `Motif : ${me.raisonSuspension.trim()}`
                                    : 'Un ou plusieurs documents n\'ont pas pu être validés.'}
                                {'\n'}Corrigez les documents refusés ci-dessous : votre dossier
                                repartira automatiquement en examen.
                            </Text>
                        </View>
                    </Card>
                ) : dossierComplet ? (
                    <Card style={[styles.statusCard, { backgroundColor: colors.primarySoft }]}>
                        <Clock4 size={22} color={colors.primary} strokeWidth={2.2} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.statusTitle, { color: colors.primary }]}>
                                Dossier complet, examen en cours
                            </Text>
                            <Text style={styles.statusText}>
                                Notre équipe examine vos documents sous 24 à 48 h. Vous recevrez
                                une notification dès la validation de votre profil.
                            </Text>
                        </View>
                    </Card>
                ) : (
                    <Card style={[styles.statusCard, { backgroundColor: colors.warningSoft }]}>
                        <Clock4 size={22} color={palette.terracotta700} strokeWidth={2.2} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.statusTitle, { color: palette.terracotta700 }]}>
                                Validation en 2 étapes
                            </Text>
                            <Text style={styles.statusText}>
                                {identiteOk ? '✓' : '1.'} Votre pièce d'identité
                                {identiteOk ? ' — envoyée' : ''}
                                {'\n'}
                                {preuvePrincipaleOk ? '✓' : '2.'} La preuve de votre métier
                                principal{preuvePrincipaleOk ? ' — envoyée' : ''}
                                {'\n'}Notre équipe valide ensuite votre profil et il devient
                                visible des clients.
                            </Text>
                        </View>
                    </Card>
                )}

                {/* ─── Étape 1 : identité ─── */}
                <Text style={styles.sectionTitle}>Étape 1 · Votre identité</Text>
                <Card style={{ gap: spacing.md }}>
                    <View style={styles.identiteHeader}>
                        <View style={styles.identiteIcon}>
                            <ContactRound size={20} color={colors.primary} strokeWidth={2} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.certTitle}>Pièce d'identité</Text>
                            <Text style={styles.certOrg}>
                                CIP, carte d'identité ou passeport
                            </Text>
                            {identite ? (
                                <StatutChip certification={identite} />
                            ) : (
                                <View style={styles.chipRow}>
                                    <XCircle size={13} color={palette.red600} strokeWidth={2.4} />
                                    <Text style={[styles.chipText, { color: palette.red700 }]}>
                                        Requise
                                    </Text>
                                </View>
                            )}
                        </View>
                        {identite &&
                            (identite.statutVerification === 'VALIDEE' ? (
                                // Document validé = verrouillé : seul l'admin peut le déverrouiller
                                <View style={styles.certAction} accessibilityLabel="Document verrouillé">
                                    <Lock size={15} color={colors.textMuted} strokeWidth={2} />
                                </View>
                            ) : (
                                <View style={styles.certActions}>
                                    <Pressable
                                        onPress={() => void onReplaceDocument(identite)}
                                        hitSlop={8}
                                        style={styles.certAction}
                                        accessibilityRole="button"
                                        accessibilityLabel="Remplacer la pièce d'identité"
                                    >
                                        <RefreshCw
                                            size={16}
                                            color={colors.textSecondary}
                                            strokeWidth={2}
                                        />
                                    </Pressable>
                                </View>
                            ))}
                    </View>
                    {!identite &&
                        (identiteEnvoi ? (
                            <View style={styles.identiteLoading}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text style={styles.certOrg}>Envoi en cours…</Text>
                            </View>
                        ) : (
                            <View style={styles.row2}>
                                <Pressable
                                    onPress={() => void envoyerIdentite('photo')}
                                    style={styles.docButton}
                                    accessibilityRole="button"
                                >
                                    <ImagePlus size={17} color={colors.primary} strokeWidth={2} />
                                    <Text style={styles.docButtonText}>Photo</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => void envoyerIdentite('pdf')}
                                    style={styles.docButton}
                                    accessibilityRole="button"
                                >
                                    <FileText size={17} color={colors.primary} strokeWidth={2} />
                                    <Text style={styles.docButtonText}>PDF</Text>
                                </Pressable>
                            </View>
                        ))}
                    <Text style={styles.privacyNote}>
                        {!identite
                            ? 'Conseils : document posé à plat, bien éclairé, texte parfaitement lisible et sans reflet. '
                            : ''}
                        Jamais montrée aux clients : elle sert uniquement à vérifier qui vous êtes.
                    </Text>
                </Card>

                {/* ─── Étape 2 : métiers ─── */}
                <Text style={styles.sectionTitle}>Étape 2 · Vos métiers</Text>
                {metiers.length === 0 && (
                    <Text style={styles.certOrg}>
                        Aucun métier déclaré : complétez d'abord votre profil professionnel.
                    </Text>
                )}
                {metiers.map((m) => {
                    const preuves = preuvesMetier.filter((c) => c.metierId === m.metier.id);
                    const formOuvert = formTarget?.metierId === m.metier.id;
                    return (
                        <Card key={m.metier.id} style={{ gap: spacing.md }}>
                            <View style={styles.metierHeader}>
                                {m.estPrincipal && (
                                    <Star size={15} color="#F59E0B" fill="#F59E0B" strokeWidth={0} />
                                )}
                                <Text style={styles.certTitle}>{m.metier.nom}</Text>
                                {m.certifie ? (
                                    <View style={[styles.metierBadge, { backgroundColor: colors.successSoft }]}>
                                        <Text style={[styles.metierBadgeText, { color: palette.green700 }]}>
                                            Certifié ✓
                                        </Text>
                                    </View>
                                ) : m.estPrincipal ? (
                                    <View style={[styles.metierBadge, { backgroundColor: colors.warningSoft }]}>
                                        <Text style={[styles.metierBadgeText, { color: palette.terracotta700 }]}>
                                            Preuve requise
                                        </Text>
                                    </View>
                                ) : (
                                    <View style={[styles.metierBadge, { backgroundColor: colors.surfaceMuted }]}>
                                        <Text style={[styles.metierBadgeText, { color: colors.textSecondary }]}>
                                            Optionnel
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* Preuves déjà envoyées pour ce métier */}
                            {preuves.map((c) => (
                                <View key={c.id} style={styles.preuveRow}>
                                    {c.documentUrl && !c.documentUrl.endsWith('.pdf') ? (
                                        <Image
                                            source={{ uri: c.documentUrl }}
                                            style={styles.certThumb}
                                            contentFit="cover"
                                        />
                                    ) : (
                                        <View style={[styles.certThumb, styles.certThumbEmpty]}>
                                            <FileText size={18} color={colors.textMuted} strokeWidth={1.8} />
                                        </View>
                                    )}
                                    <View style={{ flex: 1, gap: 2 }}>
                                        <Text style={styles.preuveTitre} numberOfLines={1}>
                                            {c.titre}
                                        </Text>
                                        {!!c.organisme && (
                                            <Text style={styles.certOrg} numberOfLines={1}>
                                                {c.organisme}
                                            </Text>
                                        )}
                                        <StatutChip certification={c} />
                                    </View>
                                    {c.statutVerification === 'VALIDEE' ? (
                                        // Validé = verrouillé (déverrouillage via l'admin)
                                        <View
                                            style={styles.certAction}
                                            accessibilityLabel="Document verrouillé"
                                        >
                                            <Lock size={14} color={colors.textMuted} strokeWidth={2} />
                                        </View>
                                    ) : (
                                        <View style={styles.certActions}>
                                            <Pressable
                                                onPress={() => void onReplaceDocument(c)}
                                                hitSlop={8}
                                                style={styles.certAction}
                                                accessibilityRole="button"
                                                accessibilityLabel="Remplacer le document"
                                            >
                                                <RefreshCw
                                                    size={15}
                                                    color={colors.textSecondary}
                                                    strokeWidth={2}
                                                />
                                            </Pressable>
                                            <Pressable
                                                onPress={() => onDelete(c)}
                                                hitSlop={8}
                                                style={styles.certAction}
                                                accessibilityRole="button"
                                                accessibilityLabel="Supprimer"
                                            >
                                                <Trash2 size={15} color={colors.danger} strokeWidth={2} />
                                            </Pressable>
                                        </View>
                                    )}
                                </View>
                            ))}

                            {/* Formulaire d'ajout pour CE métier */}
                            {formOuvert ? (
                                <View style={{ gap: spacing.md }}>
                                    <Input
                                        label="Titre du document *"
                                        placeholder={`Ex. : CAP ${m.metier.nom}, attestation…`}
                                        value={titre}
                                        onChangeText={setTitre}
                                        maxLength={200}
                                    />
                                    <Input
                                        label="Organisme (optionnel)"
                                        placeholder="Ex. : Chambre des Métiers du Bénin"
                                        value={organisme}
                                        onChangeText={setOrganisme}
                                        maxLength={200}
                                    />
                                    <View>
                                        <Text style={styles.fieldLabel}>
                                            Date d'obtention (optionnel)
                                        </Text>
                                        <Pressable
                                            onPress={() => setShowCalendar(true)}
                                            style={styles.dateButton}
                                            accessibilityRole="button"
                                            accessibilityLabel="Choisir la date d'obtention"
                                        >
                                            <CalendarDays
                                                size={17}
                                                color={dateObtention ? colors.primary : colors.textMuted}
                                                strokeWidth={2}
                                            />
                                            <Text
                                                style={[
                                                    styles.dateButtonText,
                                                    dateObtention != null && { color: colors.text },
                                                ]}
                                            >
                                                {dateObtention
                                                    ? dateObtention.toLocaleDateString('fr-FR', {
                                                          day: 'numeric',
                                                          month: 'long',
                                                          year: 'numeric',
                                                      })
                                                    : 'Toucher pour ouvrir le calendrier'}
                                            </Text>
                                            {dateObtention != null && (
                                                <Pressable
                                                    onPress={() => setDateObtention(null)}
                                                    hitSlop={8}
                                                    accessibilityLabel="Effacer la date"
                                                >
                                                    <XCircle size={16} color={colors.textMuted} strokeWidth={2} />
                                                </Pressable>
                                            )}
                                        </Pressable>
                                    </View>

                                    <Text style={styles.fieldLabel}>Document *</Text>
                                    {document ? (
                                        <View style={styles.docPreview}>
                                            {document.mimeType.startsWith('image/') ? (
                                                <Image
                                                    source={{ uri: document.uri }}
                                                    style={styles.docThumb}
                                                    contentFit="cover"
                                                />
                                            ) : (
                                                <View style={[styles.docThumb, styles.certThumbEmpty]}>
                                                    <FileText size={18} color={colors.primary} strokeWidth={2} />
                                                </View>
                                            )}
                                            <Text style={styles.docName} numberOfLines={1}>
                                                {document.name}
                                            </Text>
                                            <Pressable onPress={() => setDocument(null)} hitSlop={8}>
                                                <XCircle size={18} color={colors.textMuted} strokeWidth={2} />
                                            </Pressable>
                                        </View>
                                    ) : (
                                        <View style={styles.row2}>
                                            <Pressable
                                                onPress={async () =>
                                                    setDocument(await pickDocument('photo'))
                                                }
                                                style={styles.docButton}
                                                accessibilityRole="button"
                                            >
                                                <ImagePlus size={17} color={colors.primary} strokeWidth={2} />
                                                <Text style={styles.docButtonText}>Photo</Text>
                                            </Pressable>
                                            <Pressable
                                                onPress={async () =>
                                                    setDocument(await pickDocument('pdf'))
                                                }
                                                style={styles.docButton}
                                                accessibilityRole="button"
                                            >
                                                <FileText size={17} color={colors.primary} strokeWidth={2} />
                                                <Text style={styles.docButtonText}>PDF</Text>
                                            </Pressable>
                                        </View>
                                    )}

                                    <Button
                                        title="Envoyer pour vérification"
                                        fullWidth
                                        loading={addCertification.isPending}
                                        onPress={submitPreuve}
                                    />
                                    <Button title="Annuler" variant="ghost" fullWidth onPress={resetForm} />
                                </View>
                            ) : (
                                <Pressable
                                    onPress={() => {
                                        resetForm();
                                        setFormTarget({ metierId: m.metier.id, nom: m.metier.nom });
                                    }}
                                    style={styles.addPreuveButton}
                                    accessibilityRole="button"
                                >
                                    <Plus size={15} color={colors.primary} strokeWidth={2.4} />
                                    <Text style={styles.docButtonText}>
                                        Ajouter un diplôme ou une attestation
                                    </Text>
                                </Pressable>
                            )}
                        </Card>
                    );
                })}

                {/* Anciens documents non rattachés à un métier */}
                {orphelines.length > 0 && (
                    <Card style={{ gap: spacing.md }}>
                        <Text style={styles.certTitle}>Autres documents</Text>
                        {orphelines.map((c) => (
                            <View key={c.id} style={styles.preuveRow}>
                                {c.documentUrl && !c.documentUrl.endsWith('.pdf') ? (
                                    <Image
                                        source={{ uri: c.documentUrl }}
                                        style={styles.certThumb}
                                        contentFit="cover"
                                    />
                                ) : (
                                    <View style={[styles.certThumb, styles.certThumbEmpty]}>
                                        <FileText size={18} color={colors.textMuted} strokeWidth={1.8} />
                                    </View>
                                )}
                                <View style={{ flex: 1, gap: 2 }}>
                                    <Text style={styles.preuveTitre} numberOfLines={1}>
                                        {c.titre}
                                    </Text>
                                    <StatutChip certification={c} />
                                </View>
                                {c.statutVerification === 'VALIDEE' ? (
                                    <View
                                        style={styles.certAction}
                                        accessibilityLabel="Document verrouillé"
                                    >
                                        <Lock size={14} color={colors.textMuted} strokeWidth={2} />
                                    </View>
                                ) : (
                                    <Pressable
                                        onPress={() => onDelete(c)}
                                        hitSlop={8}
                                        style={styles.certAction}
                                        accessibilityRole="button"
                                        accessibilityLabel="Supprimer"
                                    >
                                        <Trash2 size={15} color={colors.danger} strokeWidth={2} />
                                    </Pressable>
                                )}
                            </View>
                        ))}
                    </Card>
                )}

                {/* Pendant l'examen : soigner sa vitrine (seulement si elle est vide) */}
                {(portfolio?.total ?? 0) === 0 && (
                    <Pressable
                        onPress={() => router.push('/mes-realisations')}
                        accessibilityRole="button"
                    >
                        <Card style={styles.portfolioHint}>
                            <View style={styles.portfolioHintIcon}>
                                <Images size={18} color={colors.accent} strokeWidth={2} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.certTitle}>
                                    Pendant ce temps, soignez votre vitrine
                                </Text>
                                <Text style={styles.certOrg}>
                                    Ajoutez des photos de vos chantiers : c'est la première chose
                                    que regardent les clients.
                                </Text>
                            </View>
                            <ChevronRight size={17} color={colors.textMuted} strokeWidth={2.2} />
                        </Card>
                    </Pressable>
                )}

                <View style={styles.footNote}>
                    <ShieldCheck size={14} color={colors.textMuted} strokeWidth={2} />
                    <Text style={styles.footNoteText}>
                        Vos documents ne sont jamais montrés aux clients. Seuls les titres des
                        diplômes validés apparaissent sur votre fiche, avec le badge « certifié »
                        sur les métiers approuvés. Un document validé est verrouillé (🔒) :
                        contactez le support pour demander son déverrouillage.
                    </Text>
                </View>
            </ScrollView>

            {/* Calendrier natif (Android : boîte de dialogue Material) */}
            {showCalendar && (
                <DateTimePicker
                    value={dateObtention ?? new Date(2018, 0, 1)}
                    mode="date"
                    maximumDate={new Date()}
                    onChange={(event, selected) => {
                        setShowCalendar(false);
                        if (event.type === 'set' && selected) setDateObtention(selected);
                    }}
                />
            )}
        </KeyboardAvoidingView>
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
        paddingBottom: spacing['4xl'],
        gap: spacing.md,
    },
    statusCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
        borderWidth: 0,
    },
    statusTitle: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.base,
    },
    statusText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 5,
        color: colors.textSecondary,
        marginTop: 2,
    },
    sectionTitle: {
        fontFamily: typography.heading,
        fontSize: fontSizes.base,
        color: colors.text,
        marginTop: spacing.sm,
    },
    identiteHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    identiteIcon: {
        width: 44,
        height: 44,
        borderRadius: radii.md,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    identiteLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    privacyNote: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 3,
        color: colors.textMuted,
    },
    metierHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    metierBadge: {
        marginLeft: 'auto',
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: radii.full,
    },
    metierBadgeText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs - 1,
    },
    preuveRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.background,
        borderRadius: radii.md,
        padding: spacing.sm,
    },
    preuveTitre: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    certThumb: {
        width: 46,
        height: 46,
        borderRadius: radii.sm,
        backgroundColor: colors.surfaceMuted,
    },
    certThumbEmpty: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    certTitle: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    certOrg: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
    chipRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    chipText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.xs,
    },
    rejetText: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 3,
        color: palette.red700,
    },
    certActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    certAction: {
        width: 30,
        height: 30,
        borderRadius: radii.full,
        backgroundColor: colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    row2: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    fieldLabel: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        height: 46,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        paddingHorizontal: spacing.md,
    },
    dateButtonText: {
        flex: 1,
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.textMuted,
    },
    docButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        height: 46,
        borderRadius: radii.md,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: colors.borderStrong,
        backgroundColor: colors.background,
    },
    docButtonText: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.primary,
    },
    addPreuveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        height: 42,
        borderRadius: radii.md,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: colors.borderStrong,
    },
    docPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.sm,
        borderRadius: radii.md,
        backgroundColor: colors.surfaceMuted,
    },
    docThumb: {
        width: 40,
        height: 40,
        borderRadius: radii.sm,
        backgroundColor: colors.surface,
    },
    docName: {
        flex: 1,
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.xs,
        color: colors.text,
    },
    portfolioHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.accentSoft,
        borderWidth: 0,
    },
    portfolioHintIcon: {
        width: 38,
        height: 38,
        borderRadius: radii.full,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footNote: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
    },
    footNoteText: {
        flex: 1,
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        lineHeight: lineHeights.xs + 3,
        color: colors.textMuted,
    },
});
