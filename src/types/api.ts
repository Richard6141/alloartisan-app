/**
 * Types de l'API AlloArtisan — miroir des réponses du back-end NestJS.
 */

export type Role = 'CLIENT' | 'ARTISAN' | 'ADMIN';
export type StatutBooking =
    | 'SOUMISE'
    | 'ACCEPTEE'
    | 'PRIX_PROPOSE'
    | 'CONTRE_OFFRE'
    | 'CONFIRMEE'
    | 'EN_COURS'
    | 'ATTENTE_CONFIRMATION'
    | 'TERMINEE'
    | 'ANNULEE'
    | 'LITIGE';
export type TypeBooking = 'STANDARD' | 'URGENCE' | 'DEVIS';
export type AbonnementType = 'GRATUIT' | 'STANDARD' | 'PREMIUM' | 'GOLD';

/** Rang de mise en avant (GOLD tout en haut) */
export const ABONNEMENT_RANG: Record<AbonnementType, number> = {
    GOLD: 3,
    PREMIUM: 2,
    STANDARD: 1,
    GRATUIT: 0,
};
export type TrackingPhase = 'EN_ROUTE' | 'ARRIVE' | 'EN_INTERVENTION' | 'TERMINE';

export interface AuthTokens {
    access_token: string;
    refresh_token: string;
}

export interface User {
    id: string;
    email: string;
    telephone?: string | null;
    nom?: string | null;
    prenom?: string | null;
    photoUrl?: string | null;
    role: Role;
    ville?: string | null;
    quartier?: string | null;
    emailVerified: boolean;
    profilComplet: boolean;
    codeParrainage?: string | null;
    /** Double authentification (TOTP) activée sur ce compte */
    mfaEnabled?: boolean;
}

export interface CategorieMetier {
    id: string;
    nom: string;
    slug: string;
    description?: string | null;
    iconUrl?: string | null;
    metiers?: Metier[];
}

export interface Metier {
    id: string;
    nom: string;
    slug: string;
    categorieId: string;
    populaire: boolean;
    // Renvoyée par l'API (jointure catégorie) ; sert à grouper/suggérer un métier.
    categorie?: { id: string; nom: string; slug: string };
}

export interface ArtisanSummary {
    id: string;
    nomEntreprise?: string | null;
    photoProfilUrl?: string | null;
    photoCouvertureUrl?: string | null;
    villePrincipale: string;
    noteMoyenne: number;
    nombreAvis: number;
    tarifHoraire?: number | null;
    disponible: boolean;
    verified: boolean;
    accepteUrgences: boolean;
    /** Temps de réponse moyen à une demande, en minutes (réactivité) */
    tempsReponseMinutes?: number | null;
    abonnementType: AbonnementType;
    /** Badge Ambassadeur (programme de parrainage) */
    ambassadeurNiveau?: 'BRONZE' | 'ARGENT' | 'OR' | null;
    distanceKm?: number | null;
    /** Position (légèrement floutée) : uniquement sur /geolocation/artisans/nearby, pour la carte */
    latitude?: number | null;
    longitude?: number | null;
    /** Renvoyé par /artisans/search */
    metierPrincipal?: Metier | null;
    /** Renvoyé par /artisans/:id */
    metiers?: {
        metier: Metier;
        estPrincipal: boolean;
        tarifHoraire?: number | null;
        anneesExperience?: number | null;
        certifie?: boolean;
        description?: string | null;
    }[];
    user?: Pick<User, 'nom' | 'prenom' | 'photoUrl' | 'telephone'>;
}

export type StatutArtisan = 'EN_ATTENTE' | 'ACTIF' | 'SUSPENDU' | 'REJETE';

export interface HoraireTravail {
    jour: string;
    ouverture: string;
    fermeture: string;
    ouvert: boolean;
}

export interface ArtisanDetail extends ArtisanSummary {
    bio?: string | null;
    slogan?: string | null;
    numeroIfu?: string | null;
    anneesExperience: number;
    portfolioUrls?: string[] | null;
    photoCouvertureUrl?: string | null;
    zoneInterventionKm: number;
    tarifDeplacement?: number | null;
    nombreMissionsCompletees: number;
    accepteWeekend: boolean;
    horairesTravail?: HoraireTravail[] | null;
    certifications?: { id: string; titre: string; organisme?: string; verifie: boolean }[];
    /** Présents sur /artisans/me : cycle de validation du profil */
    statut?: StatutArtisan;
    /** Motif de rejet ou de suspension du profil, lisible par l'artisan */
    raisonSuspension?: string | null;
    verifiedAt?: string | null;
    adresseAtelier?: string | null;
}

export interface Certification {
    id: string;
    artisanId?: string;
    titre: string;
    organisme?: string | null;
    dateObtention?: string | null;
    numeroCertification?: string | null;
    documentUrl?: string | null;
    verifie: boolean;
    /** IDENTITE = pièce d'identité (une seule, jamais publique) ; METIER = diplôme/attestation */
    type: 'IDENTITE' | 'METIER';
    /** Métier prouvé par ce document */
    metierId?: string | null;
    /** Cycle d'examen du document */
    statutVerification: 'EN_ATTENTE' | 'VALIDEE' | 'REJETEE';
    /** Motif du rejet, pour corriger et resoumettre */
    raisonRejet?: string | null;
    createdAt: string;
}

export interface PortfolioItem {
    url: string;
    type: 'photo' | 'video';
    caption?: string | null;
    thumbnailUrl?: string | null;
    uploadedAt?: string | null;
}

export interface Portfolio {
    artisanId: string;
    items: PortfolioItem[];
    total: number;
    maxAllowed: number;
}

export interface Booking {
    id: string;
    statut: StatutBooking;
    type: TypeBooking;
    titre: string;
    description: string;
    adresseIntervention: string;
    datePreferee?: string | null;
    budgetClient?: number | null;
    prixPropose?: number | null;
    prixFinal?: number | null;
    estUrgent: boolean;
    createdAt: string;
    metier?: Metier;
    artisan?: ArtisanSummary;
    client?: Pick<User, 'id' | 'nom' | 'prenom' | 'photoUrl' | 'telephone'>;
    /** Présent si le client a déjà noté cette intervention */
    avis?: { id: string; note: number } | null;
}

/** État du verrou paywall côté artisan (déblocage par essai ou abonnement) */
export interface PaywallGate {
    plan: 'GRATUIT' | 'STANDARD' | 'PREMIUM' | 'GOLD';
    methode: 'essai' | 'abonnement';
    essaisRestants: number;
    demandesRestantes: number | null;
    peutDebloquer: boolean;
}

export interface Conversation {
    id: string;
    clientId: string;
    artisanId: string;
    bookingId?: string | null;
    lastMessageAt?: string | null;
    /** Le back renvoie le dernier message dans messages[0] */
    messages?: Message[];
    unreadCount?: number;
    /** Paywall : true si l'artisan n'a pas encore débloqué cette conversation */
    verrouille?: boolean;
    /** CLIENT (client↔artisan) ou TRAVAIL (patron↔main-d'œuvre, gratuit) */
    contexte?: 'CLIENT' | 'TRAVAIL';
    client?: {
        id: string;
        nom?: string | null;
        prenom?: string | null;
        photoUrl?: string | null;
        telephone?: string | null;
    };
    artisan?: {
        id: string;
        nomEntreprise?: string | null;
        photoProfilUrl?: string | null;
        user?: {
            id: string;
            nom?: string | null;
            prenom?: string | null;
            photoUrl?: string | null;
            telephone?: string | null;
        };
    };
}

export interface Message {
    id: string;
    conversationId: string;
    senderId: string;
    type: 'text' | 'image' | 'audio' | 'video' | 'location';
    contenu?: string | null;
    mediaUrl?: string | null;
    /** Durée d'un message vocal, en secondes */
    mediaDuree?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    /** Remis au destinataire (app en ligne) → ✓✓ gris */
    remis?: boolean;
    lu: boolean;
    createdAt: string;
    /** Actions type WhatsApp */
    replyToId?: string | null;
    replyTo?: {
        id: string;
        type: string;
        contenu?: string | null;
        mediaUrl?: string | null;
        senderId: string;
        supprime?: boolean;
    } | null;
    modifieAt?: string | null;
    supprime?: boolean;
    /** Forme d'onde des vocaux (niveaux 0..1, max 64 barres) */
    waveform?: number[] | null;
}

export interface AppNotification {
    id: string;
    type: string;
    titre: string;
    corps: string;
    data?: Record<string, unknown>;
    lu: boolean;
    createdAt: string;
}

export interface LivePosition {
    bookingId: string;
    latitude: number;
    longitude: number;
    heading?: number;
    distanceMetres?: number;
    etaMinutes?: number;
    updatedAt: string;
}

export interface TrackingState {
    bookingId: string;
    phase: TrackingPhase | null;
    position: LivePosition | null;
    destination: { latitude: number; longitude: number } | null;
}

export interface Paginated<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
}

// ==================== MAIN-D'ŒUVRE (aides & ouvriers) ====================

export type TypeTravailleur = 'OUVRIER' | 'AIDE';
export type DisponibiliteTravailleur = 'PONCTUEL' | 'REGULIER';

export interface TravailleurMetier {
    metierId: string;
    estPrincipal: boolean;
    metier?: { id: string; nom: string };
}

export interface ProfilTravailleur {
    id: string;
    userId: string;
    type: TypeTravailleur;
    actif: boolean;
    polyvalent: boolean;
    description?: string | null;
    anneesExperience?: number | null;
    latitude: number;
    longitude: number;
    villePrincipale: string;
    zoneInterventionKm: number;
    disponibilite: DisponibiliteTravailleur;
    disponibleMaintenant: boolean;
    tarifJournalier?: number | null;
    identiteVerifiee: boolean;
    noteMoyenne: number;
    nombreAvis: number;
    distanceKm?: number | null;
    user?: { nom?: string | null; prenom?: string | null; photoUrl?: string | null };
    metiers?: TravailleurMetier[];
}

export interface EngagementTravail {
    id: string;
    patronUserId: string;
    profilTravailleurId: string;
    conversationId?: string | null;
    statut: 'EN_COURS' | 'TERMINE' | 'ANNULE';
    createdAt: string;
    termineAt?: string | null;
}

export type PeriodeChantier = 'UNE_JOURNEE' | 'PLUSIEURS_JOURS' | 'REGULIER';
export type StatutAnnonce = 'OUVERTE' | 'POURVUE' | 'CLOSE';

export interface AnnonceChantier {
    id: string;
    patronUserId: string;
    type: TypeTravailleur;
    metierId?: string | null;
    nombrePersonnes: number;
    latitude: number;
    longitude: number;
    ville: string;
    periode: PeriodeChantier;
    tarifJournalier?: number | null;
    description: string;
    statut: StatutAnnonce;
    createdAt: string;
    distanceKm?: number | null;
    metier?: { id: string; nom: string } | null;
    patron?: { nom?: string | null; prenom?: string | null };
    _count?: { interets: number };
}

export interface CandidatInteret {
    id: string;
    message?: string | null;
    createdAt: string;
    profil: ProfilTravailleur;
}
