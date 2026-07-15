import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/queryClient';
import { useAuth } from '../../stores/auth';
import type { AppNotification } from '../../types/api';

/** Compteur de non-lues — alimente le point rouge de la cloche (poll 30 s) */
export function useUnreadCount() {
    const status = useAuth((s) => s.status);
    return useQuery({
        queryKey: [...queryKeys.notifications, 'unread'],
        queryFn: async () => {
            const { data } = await api.get<{ count: number }>('/notifications/unread-count');
            return data.count;
        },
        enabled: status === 'authenticated',
        refetchInterval: 30000,
        staleTime: 15000,
    });
}

export function useNotifications() {
    const status = useAuth((s) => s.status);
    return useQuery({
        queryKey: queryKeys.notifications,
        queryFn: async () => {
            const { data } = await api.get<{ data: AppNotification[] }>('/notifications', {
                params: { limit: 50 },
            });
            return data.data;
        },
        enabled: status === 'authenticated',
    });
}

/** Marque tout comme lu (appelé à l'ouverture de l'écran notifications) */
export function useMarkAllRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            await api.patch('/notifications/read-all');
        },
        onSuccess: () => {
            queryClient.setQueryData([...queryKeys.notifications, 'unread'], 0);
            void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
        },
    });
}
