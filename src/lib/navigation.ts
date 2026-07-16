import { Alert, Linking } from 'react-native';

export interface NavTarget {
    latitude: number;
    longitude: number;
    /** Libellé affiché dans le choix (ex. adresse du client) */
    label?: string;
}

/**
 * Ouvre l'application de navigation du téléphone (Google Maps / Waze) en
 * mode itinéraire vers la destination — vraie navigation vocale gratuite,
 * sans clé API. Les liens https ouvrent l'app native si installée, sinon le
 * navigateur (qui redirige vers l'app/le store).
 */
export function openExternalNavigation({ latitude, longitude, label }: NavTarget): void {
    const dest = `${latitude},${longitude}`;
    const googleMaps = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
    const waze = `https://waze.com/ul?ll=${dest}&navigate=yes`;

    const openUrl = (url: string) =>
        Linking.openURL(url).catch(() =>
            Alert.alert('Navigation indisponible', "Impossible d'ouvrir l'application de carte."),
        );

    Alert.alert(
        'Lancer l’itinéraire',
        label ? `Vers : ${label}` : 'Choisissez votre application de navigation',
        [
            { text: 'Google Maps', onPress: () => void openUrl(googleMaps) },
            { text: 'Waze', onPress: () => void openUrl(waze) },
            { text: 'Annuler', style: 'cancel' },
        ],
        { cancelable: true },
    );
}
