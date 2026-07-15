import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { MessageSquareDashed, Settings2, Lock } from 'lucide-react-native';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { useAuth } from '../../stores/auth';
import { LoginInvite } from '../../components/LoginInvite';
import { Avatar, Skeleton, EmptyState } from '../../components/ui';
import type { Conversation } from '../../types/api';
import { colors, palette, spacing, typography, fontSizes, radii } from '../../theme/tokens';

export default function MessagesScreen() {
    const status = useAuth((s) => s.status);

    if (status !== 'authenticated') {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <LoginInvite
                    title="Vos messages"
                    message="Connectez-vous pour discuter avec les artisans en temps réel."
                />
            </SafeAreaView>
        );
    }

    return <ConversationsList />;
}

function ConversationsList() {
    const router = useRouter();
    const { data, isLoading } = useQuery({
        queryKey: queryKeys.conversations,
        queryFn: async () => {
            const { data } = await api.get<Conversation[]>('/messages/conversations');
            return data;
        },
        refetchInterval: 30000, // léger polling en plus du WebSocket
    });

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Titre + réglages des discussions (comme WhatsApp : dans l'écran concerné) */}
            <View style={styles.titleRow}>
                <Text style={styles.title}>Messages</Text>
                <Pressable
                    onPress={() => router.push('/parametres-discussions')}
                    hitSlop={10}
                    style={styles.settingsButton}
                    accessibilityRole="button"
                    accessibilityLabel="Réglages des discussions"
                >
                    <Settings2 size={20} color={colors.textSecondary} strokeWidth={2} />
                </Pressable>
            </View>
            {isLoading && !data ? (
                <View style={{ paddingHorizontal: spacing.xl }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <View key={i} style={styles.skeletonRow}>
                            <Skeleton width={52} height={52} borderRadius={radii.full} />
                            <View style={{ flex: 1, gap: spacing.sm }}>
                                <Skeleton width="55%" height={14} />
                                <Skeleton width="85%" height={12} />
                            </View>
                        </View>
                    ))}
                </View>
            ) : !data || data.length === 0 ? (
                <EmptyState
                    icon={
                        <MessageSquareDashed size={48} color={colors.textMuted} strokeWidth={1.5} />
                    }
                    title="Aucune conversation"
                    message="Contactez un artisan depuis son profil pour démarrer une discussion."
                />
            ) : (
                <FlashList
                    data={data}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
                    renderItem={({ item }) => <ConversationRow conversation={item} />}
                />
            )}
        </SafeAreaView>
    );
}

function ConversationRow({ conversation }: { conversation: Conversation }) {
    const router = useRouter();
    const userId = useAuth((s) => s.user?.id);

    // L'interlocuteur : si JE suis le client → l'artisan, sinon → le client
    const isMeClient = conversation.clientId === userId;
    const nom = isMeClient
        ? (conversation.artisan?.nomEntreprise ??
              `${conversation.artisan?.user?.prenom ?? ''} ${conversation.artisan?.user?.nom ?? ''}`.trim()) ||
          'Artisan'
        : `${conversation.client?.prenom ?? ''} ${conversation.client?.nom ?? ''}`.trim() ||
          'Client';
    const photo = isMeClient
        ? (conversation.artisan?.photoProfilUrl ?? conversation.artisan?.user?.photoUrl)
        : conversation.client?.photoUrl;
    // Paywall : conversation verrouillée côté artisan (aperçu masqué)
    const verrouille = conversation.verrouille === true;
    const lastMessage = conversation.messages?.[0];

    const heure = conversation.lastMessageAt
        ? new Date(conversation.lastMessageAt).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
          })
        : '';

    return (
        <Pressable
            onPress={() =>
                router.push({
                    pathname: '/conversation/[id]',
                    params: { id: conversation.id, nom },
                })
            }
            accessibilityRole="button"
            accessibilityLabel={`Ouvrir la conversation avec ${nom}`}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}>
            <Avatar name={nom} uri={photo} size={52} />
            <View style={{ flex: 1 }}>
                <View style={styles.rowTop}>
                    <View style={styles.nameWrap}>
                        <Text style={styles.rowName} numberOfLines={1}>
                            {nom}
                        </Text>
                        {conversation.contexte === 'TRAVAIL' && (
                            <View style={styles.chantierTag}>
                                <Text style={styles.chantierTxt}>Chantier</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.rowTime}>{heure}</Text>
                </View>
                <View style={styles.rowBottom}>
                    {verrouille ? (
                        <View style={styles.lockedPreview}>
                            <Lock size={13} color={colors.accent} strokeWidth={2.4} />
                            <Text style={[styles.rowPreview, styles.lockedText]} numberOfLines={1}>
                                Nouveau client · débloquez pour répondre
                            </Text>
                        </View>
                    ) : (
                        <Text style={styles.rowPreview} numberOfLines={1}>
                            {!lastMessage
                                ? 'Nouvelle conversation'
                                : lastMessage.supprime
                                  ? '🚫 Message supprimé'
                                  : lastMessage.type === 'image'
                                    ? '📷 Photo'
                                    : lastMessage.type === 'video'
                                      ? '🎥 Vidéo'
                                      : lastMessage.type === 'audio'
                                        ? '🎤 Message vocal'
                                        : lastMessage.type === 'location'
                                          ? '📍 Position'
                                          : lastMessage.contenu || 'Message'}
                        </Text>
                    )}
                    {conversation.unreadCount ? (
                        <View style={styles.unreadDot}>
                            <Text style={styles.unreadText}>{conversation.unreadCount}</Text>
                        </View>
                    ) : null}
                </View>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.lg,
        paddingBottom: spacing.lg,
    },
    title: {
        fontFamily: typography.heading,
        fontSize: fontSizes.xl,
        color: colors.text,
    },
    settingsButton: {
        width: 38,
        height: 38,
        borderRadius: radii.full,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    skeletonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.xl,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
    },
    rowTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    rowName: {
        fontFamily: typography.bodyBold,
        fontSize: fontSizes.md,
        color: colors.text,
        flexShrink: 1,
    },
    nameWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    chantierTag: {
        backgroundColor: palette.terracotta100,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: radii.sm,
    },
    chantierTxt: {
        fontFamily: typography.bodySemiBold,
        fontSize: 10,
        color: palette.terracotta700,
    },
    rowTime: {
        fontFamily: typography.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },
    rowBottom: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: 2,
    },
    rowPreview: {
        fontFamily: typography.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        flex: 1,
    },
    lockedPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        flex: 1,
    },
    lockedText: {
        fontFamily: typography.bodySemiBold,
        color: colors.accent,
    },
    unreadDot: {
        minWidth: 20,
        height: 20,
        borderRadius: radii.full,
        backgroundColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5,
    },
    unreadText: {
        fontFamily: typography.bodyBold,
        fontSize: 11,
        color: colors.onDark,
    },
});
