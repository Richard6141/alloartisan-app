/**
 * AlloArtisan — Design tokens
 *
 * Direction : « Trust & Authority » adapté à l'artisanat ouest-africain.
 * Navy profond (confiance, héritage de la marque) + terracotta (argile,
 * métier manuel) + vert (Mobile Money, succès).
 *
 * Règles :
 * - Jamais de hex brut dans les composants — toujours passer par ces tokens.
 * - Espacement sur grille de 4.
 * - Contraste AA minimum (4.5:1) pour tout texte.
 */

export const palette = {
    // Marque — navy (héritage du bleu #1e40af, assombri pour l'autorité)
    navy900: '#12275E',
    navy800: '#1E3A8A',
    navy700: '#1E40AF',
    navy600: '#2B52C9',
    navy100: '#DBE4F8',
    navy50: '#EEF2FC',

    // Accent — terracotta (argile, artisanat)
    terracotta700: '#92400E',
    terracotta600: '#B45309',
    terracotta500: '#D97706',
    terracotta100: '#FCE9D4',
    terracotta50: '#FDF4E7',

    // Succès / Mobile Money
    green700: '#047857',
    green600: '#059669',
    green100: '#D1FAE5',

    // Erreur / urgence
    red700: '#B91C1C',
    red600: '#DC2626',
    red100: '#FEE2E2',

    // Avertissement
    amber600: '#D97706',
    amber100: '#FEF3C7',

    // Neutres (slate — froid, propre)
    slate900: '#0F172A',
    slate700: '#334155',
    slate500: '#64748B',
    slate400: '#94A3B8',
    slate300: '#CBD5E1',
    slate200: '#E2E8F0',
    slate100: '#F1F5F9',
    slate50: '#F8FAFC',
    white: '#FFFFFF',
} as const;

/** Tokens sémantiques — à utiliser dans les composants */
export const colors = {
    primary: palette.navy800,
    primaryPressed: palette.navy900,
    primarySoft: palette.navy50,
    onPrimary: palette.white,

    accent: palette.terracotta600,
    accentPressed: palette.terracotta700,
    accentSoft: palette.terracotta50,
    onAccent: palette.white,

    success: palette.green600,
    successSoft: palette.green100,
    danger: palette.red600,
    dangerSoft: palette.red100,
    warning: palette.amber600,
    warningSoft: palette.amber100,

    background: palette.slate50,
    surface: palette.white,
    surfaceMuted: palette.slate100,

    text: palette.slate900,
    textSecondary: palette.slate500,
    textMuted: palette.slate400,
    onDark: palette.white,

    border: palette.slate200,
    borderStrong: palette.slate300,

    overlay: 'rgba(15, 23, 42, 0.55)',
} as const;

/** Couleurs des catégories de métiers (fonds pastels + icône foncée) */
export const categoryColors: Record<string, { bg: string; fg: string }> = {
    plomberie: { bg: '#DBEAFE', fg: '#1D4ED8' },
    electricite: { bg: '#FEF3C7', fg: '#B45309' },
    maconnerie: { bg: '#E2E8F0', fg: '#334155' },
    menuiserie: { bg: '#FDE8D4', fg: '#9A3412' },
    peinture: { bg: '#FCE7F3', fg: '#BE185D' },
    climatisation: { bg: '#CFFAFE', fg: '#0E7490' },
    jardinage: { bg: '#DCFCE7', fg: '#15803D' },
    couture: { bg: '#EDE9FE', fg: '#6D28D9' },
    coiffure: { bg: '#FFE4E6', fg: '#BE123C' },
    mecanique: { bg: '#F1F5F9', fg: '#0F172A' },
    default: { bg: palette.navy50, fg: palette.navy700 },
};

/** Grille de 4 */
export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
} as const;

export const radii = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 999,
} as const;

/**
 * Typographie — Plus Jakarta Sans (une seule famille, du 400 au 800) :
 * géométrique, raffinée et très lisible sur petits écrans.
 * Corps de texte ≥ 14, jamais en dessous de 12.
 */
export const typography = {
    heading: 'PlusJakartaSans_800ExtraBold',
    headingMedium: 'PlusJakartaSans_700Bold',
    body: 'PlusJakartaSans_400Regular',
    bodyMedium: 'PlusJakartaSans_500Medium',
    bodySemiBold: 'PlusJakartaSans_600SemiBold',
    bodyBold: 'PlusJakartaSans_700Bold',
} as const;

export const fontSizes = {
    xs: 12,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 22,
    '2xl': 26,
    '3xl': 32,
} as const;

export const lineHeights = {
    xs: 16,
    sm: 18,
    base: 22,
    md: 24,
    lg: 26,
    xl: 28,
    '2xl': 32,
    '3xl': 38,
} as const;

/** Ombres discrètes — élévation cohérente, jamais de grosses ombres floues */
export const shadows = {
    card: {
        shadowColor: palette.slate900,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    raised: {
        shadowColor: palette.slate900,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 6,
    },
} as const;

/** Durées d'animation standardisées (150-300ms) */
export const motion = {
    fast: 150,
    base: 220,
    slow: 300,
} as const;

/** Taille minimale d'une zone tactile */
export const TOUCH_TARGET = 44;
