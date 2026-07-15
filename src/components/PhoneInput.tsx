import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    TextInput,
    Modal,
    FlatList,
} from 'react-native';
import { getLocales } from 'expo-localization';
import { Check, ChevronDown, X } from 'lucide-react-native';
import { colors, spacing, typography, fontSizes, radii, TOUCH_TARGET } from '../theme/tokens';

/**
 * Champ téléphone international : sélecteur de pays (drapeau + indicatif),
 * longueur et format imposés par pays, pays par défaut déduit de la région
 * du téléphone. Bénin en tête, extensible à toute l'Afrique de l'Ouest.
 *
 * Valeur émise : indicatif + chiffres collés (ex. « +2290197000000 »),
 * prête pour la base et les appels.
 */

export interface PhoneCountry {
    code: string;
    nom: string;
    flag: string;
    dial: string;
    /** Nombre de chiffres du numéro national */
    digits: number;
    exemple: string;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
    { code: 'BJ', nom: 'Bénin', flag: '🇧🇯', dial: '+229', digits: 10, exemple: '01 97 00 00 00' },
    { code: 'TG', nom: 'Togo', flag: '🇹🇬', dial: '+228', digits: 8, exemple: '90 00 00 00' },
    { code: 'CI', nom: 'Côte d\'Ivoire', flag: '🇨🇮', dial: '+225', digits: 10, exemple: '07 00 00 00 00' },
    { code: 'SN', nom: 'Sénégal', flag: '🇸🇳', dial: '+221', digits: 9, exemple: '77 000 00 00' },
    { code: 'BF', nom: 'Burkina Faso', flag: '🇧🇫', dial: '+226', digits: 8, exemple: '70 00 00 00' },
    { code: 'NE', nom: 'Niger', flag: '🇳🇪', dial: '+227', digits: 8, exemple: '90 00 00 00' },
    { code: 'ML', nom: 'Mali', flag: '🇲🇱', dial: '+223', digits: 8, exemple: '70 00 00 00' },
    { code: 'NG', nom: 'Nigéria', flag: '🇳🇬', dial: '+234', digits: 10, exemple: '803 000 0000' },
    { code: 'GH', nom: 'Ghana', flag: '🇬🇭', dial: '+233', digits: 9, exemple: '24 000 0000' },
    { code: 'CM', nom: 'Cameroun', flag: '🇨🇲', dial: '+237', digits: 9, exemple: '6 70 00 00 00' },
];

/** Pays par défaut : la région du téléphone si on la couvre, sinon le Bénin */
function defaultCountry(): PhoneCountry {
    const region = getLocales()[0]?.regionCode?.toUpperCase();
    return PHONE_COUNTRIES.find((c) => c.code === region) ?? PHONE_COUNTRIES[0];
}

/** Décompose une valeur stockée (« +22901970000 » ou « 97000000 ») */
function parseValue(value: string): { country: PhoneCountry; digits: string } {
    const raw = value.replace(/[^\d+]/g, '');
    if (raw.startsWith('+')) {
        // Indicatifs triés du plus long au plus court pour un match exact
        const match = [...PHONE_COUNTRIES]
            .sort((a, b) => b.dial.length - a.dial.length)
            .find((c) => raw.startsWith(c.dial));
        if (match) {
            return { country: match, digits: raw.slice(match.dial.length) };
        }
    }
    return { country: defaultCountry(), digits: raw.replace(/\D/g, '') };
}

/** Espace tous les 2 chiffres : « 0197000000 » → « 01 97 00 00 00 » */
function pretty(digits: string): string {
    return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}

/** Un numéro complet et plausible ? (utilisé par les écrans avant d'enregistrer) */
export function isPhoneComplete(value: string): boolean {
    if (!value.trim()) return false;
    const { country, digits } = parseValue(value);
    return digits.length === country.digits;
}

interface PhoneInputProps {
    label: string;
    value: string;
    onChangeValue: (fullValue: string) => void;
    helper?: string;
}

export function PhoneInput({ label, value, onChangeValue, helper }: PhoneInputProps) {
    const parsed = useMemo(() => parseValue(value), [value]);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [focused, setFocused] = useState(false);
    // Pays choisi à la main tant qu'aucun chiffre n'est saisi (la valeur vide
    // ne peut pas porter l'indicatif)
    const [manualCountry, setManualCountry] = useState<PhoneCountry | null>(null);

    const country = value ? parsed.country : (manualCountry ?? parsed.country);
    const digits = parsed.digits;
    const incomplete = digits.length > 0 && digits.length < country.digits;

    const onDigits = (text: string) => {
        const next = text.replace(/\D/g, '').slice(0, country.digits);
        onChangeValue(next ? `${country.dial}${next}` : '');
    };

    const onCountry = (next: PhoneCountry) => {
        setPickerOpen(false);
        setManualCountry(next);
        // Les chiffres saisis suivent, tronqués à la longueur du nouveau pays
        const kept = digits.slice(0, next.digits);
        onChangeValue(kept ? `${next.dial}${kept}` : '');
    };

    return (
        <View style={{ gap: spacing.xs }}>
            <Text style={styles.label}>{label}</Text>
            <View style={[styles.row, focused && { borderColor: colors.primary }]}>
                <Pressable
                    onPress={() => setPickerOpen(true)}
                    style={styles.countryButton}
                    accessibilityRole="button"
                    accessibilityLabel={`Pays : ${country.nom}, indicatif ${country.dial}`}
                >
                    <Text style={styles.flag}>{country.flag}</Text>
                    <Text style={styles.dial}>{country.dial}</Text>
                    <ChevronDown size={14} color={colors.textSecondary} strokeWidth={2.2} />
                </Pressable>
                <View style={styles.separator} />
                <TextInput
                    value={pretty(digits)}
                    onChangeText={onDigits}
                    placeholder={country.exemple}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    style={styles.input}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    maxLength={country.digits + Math.ceil(country.digits / 2)}
                />
            </View>
            {incomplete ? (
                <Text style={styles.error}>
                    {country.digits} chiffres attendus pour le {country.nom} ({digits.length}/
                    {country.digits})
                </Text>
            ) : helper ? (
                <Text style={styles.helper}>{helper}</Text>
            ) : null}

            {/* Sélecteur de pays */}
            <Modal
                visible={pickerOpen}
                transparent
                animationType="slide"
                onRequestClose={() => setPickerOpen(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Choisir le pays</Text>
                            <Pressable
                                onPress={() => setPickerOpen(false)}
                                hitSlop={10}
                                accessibilityRole="button"
                                accessibilityLabel="Fermer"
                            >
                                <X size={20} color={colors.text} strokeWidth={2.2} />
                            </Pressable>
                        </View>
                        <FlatList
                            data={PHONE_COUNTRIES}
                            keyExtractor={(c) => c.code}
                            renderItem={({ item }) => {
                                const selected = item.code === country.code;
                                return (
                                    <Pressable
                                        onPress={() => onCountry(item)}
                                        style={styles.countryRow}
                                        accessibilityRole="button"
                                    >
                                        <Text style={styles.flag}>{item.flag}</Text>
                                        <Text style={styles.countryName}>{item.nom}</Text>
                                        <Text style={styles.countryDial}>{item.dial}</Text>
                                        {selected && (
                                            <Check
                                                size={17}
                                                color={colors.primary}
                                                strokeWidth={2.4}
                                            />
                                        )}
                                    </Pressable>
                                );
                            }}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    label: {
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: TOUCH_TARGET + 4,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    countryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        height: '100%',
    },
    flag: {
        fontSize: 18,
    },
    dial: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.text,
    },
    separator: {
        width: 1,
        alignSelf: 'stretch',
        marginVertical: spacing.sm,
        backgroundColor: colors.border,
    },
    input: {
        flex: 1,
        paddingHorizontal: spacing.md,
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.base,
        color: colors.text,
        height: '100%',
    },
    helper: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },
    error: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.danger,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'flex-end',
    },
    modalSheet: {
        maxHeight: '70%',
        backgroundColor: colors.surface,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        paddingBottom: spacing['2xl'],
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: {
        fontFamily: typography.heading,
        fontSize: fontSizes.md,
        color: colors.text,
    },
    countryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
    },
    countryName: {
        flex: 1,
        fontFamily: typography.bodyMedium,
        fontSize: fontSizes.base,
        color: colors.text,
    },
    countryDial: {
        fontFamily: typography.bodySemiBold,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
});
