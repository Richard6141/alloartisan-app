import React from 'react';
import { Tabs } from 'expo-router';
import { TabBar } from '../../components/TabBar';
import { useAuth } from '../../stores/auth';

export default function TabsLayout() {
    const isArtisan = useAuth((s) => s.user?.role === 'ARTISAN');

    return (
        <Tabs
            tabBar={(props) => <TabBar {...props} />}
            screenOptions={{ headerShown: false }}
        >
            {/* La Recherche au centre : c'est le bouton flottant de la barre */}
            <Tabs.Screen name="index" options={{ title: 'Accueil' }} />
            <Tabs.Screen
                name="reservations"
                options={{ title: isArtisan ? 'Missions' : 'Réservations' }}
            />
            <Tabs.Screen name="recherche" options={{ title: 'Recherche' }} />
            <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
            <Tabs.Screen name="profil" options={{ title: 'Profil' }} />
        </Tabs>
    );
}
