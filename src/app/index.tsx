import { Redirect } from 'expo-router';
import { useAuth } from '../stores/auth';

/** Aiguillage racine : onboarding la première fois, sinon les onglets. */
export default function Index() {
    const status = useAuth((s) => s.status);

    if (status === 'onboarding') return <Redirect href="/onboarding" />;
    return <Redirect href="/(tabs)" />;
}
