'use client';

import {
  type Me,
  type Notification,
  type Page,
  ServerEvent,
  type ServerToClientEvents,
} from '@instagram/shared';
import { type InfiniteData, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useMe } from '@/features/profile/queries';
import { queryKeys } from '@/lib/query-keys';
import { connectSocket } from '@/lib/socket';
import { useUiStore } from '@/stores/ui-store';

// NOTIF-2: a new notification goes to the top of the list and adds to the red counter
// (not while the list is on screen: it is being read). Mounted once; renders nothing.
export function NotificationsBridge() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const meId = me?.id;

  useEffect(() => {
    if (!meId) return;
    const socket = connectSocket();

    const onNotification: ServerToClientEvents[typeof ServerEvent.NOTIFICATION_NEW] = (
      notification,
    ) => {
      queryClient.setQueryData<InfiniteData<Page<Notification>>>(
        queryKeys.notifications(),
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((page, i) =>
              i === 0 ? { ...page, items: [notification, ...page.items] } : page,
            ),
          },
      );

      const reading =
        useUiStore.getState().notificationsOpen || window.location.pathname === '/notifications';
      const isRequest = notification.type === 'FOLLOW_REQUEST';
      queryClient.setQueryData<Me>(
        queryKeys.me(),
        (m) =>
          m && {
            ...m,
            unreadNotificationsCount: m.unreadNotificationsCount + (reading ? 0 : 1),
            pendingFollowRequestsCount: m.pendingFollowRequestsCount + (isRequest ? 1 : 0),
          },
      );
      if (isRequest) void queryClient.invalidateQueries({ queryKey: queryKeys.followRequests() });
    };

    socket.on(ServerEvent.NOTIFICATION_NEW, onNotification);
    return () => {
      socket.off(ServerEvent.NOTIFICATION_NEW, onNotification);
    };
  }, [meId, queryClient]);

  return null;
}
