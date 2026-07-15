import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../stores/auth';
import { colors } from '../../theme/tokens';

export default function AuthLayout() {
    const status = useAuth((s) => s.status);

    // Déjà connecté → retour aux onglets
    if (status === 'authenticated') return <Redirect href="/(tabs)" />;

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                animation: 'slide_from_right',
            }}
        />
    );
}
