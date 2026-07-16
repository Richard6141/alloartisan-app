/**
 * Optimisation d'affichage des images Cloudinary.
 *
 * Sans transformation, on télécharge l'ORIGINAL (souvent 1080-1920 px) même
 * pour un avatar de 52 px → lent et lourd. On insère donc à la volée des
 * transformations Cloudinary :
 * - `f_auto`  : meilleur format (WebP/AVIF) selon l'appareil
 * - `q_auto`  : qualité automatique (poids réduit, œil satisfait)
 * - `w_/h_`   : redimensionne à la taille RÉELLE d'affichage (×2 pour le retina)
 * - `c_fill`  : recadre (+ `g_face` pour centrer sur le visage des avatars)
 *
 * Les URLs non-Cloudinary sont renvoyées telles quelles.
 */
export function optimizedImage(
    url?: string | null,
    opts?: { width?: number; height?: number; face?: boolean },
): string | undefined {
    if (!url) return undefined;
    if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
    // Déjà transformée ? (évite d'empiler des transformations)
    if (/\/upload\/[^/]*(f_auto|q_auto|w_\d)/.test(url)) return url;

    const t: string[] = ['f_auto', 'q_auto'];
    const dpr = 2; // netteté écrans haute densité, tout en restant bien plus léger
    if (opts?.width) t.push(`w_${Math.round(opts.width * dpr)}`);
    if (opts?.height) t.push(`h_${Math.round(opts.height * dpr)}`);
    if (opts?.width && opts?.height) {
        t.push('c_fill');
        if (opts.face) t.push('g_face');
    }
    return url.replace('/upload/', `/upload/${t.join(',')}/`);
}
