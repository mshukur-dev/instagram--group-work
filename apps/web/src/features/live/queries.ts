'use client';

import { ServerEvent } from '@instagram/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { connectSocket } from '@/lib/socket';
import { endLive, getLiveOf, getLives, joinLive, startLive } from './api';

export const liveKeys = {
  all: ['lives'] as const,
  following: () => ['lives', 'following'] as const,
  of: (username: string) => ['lives', 'user', username] as const,
};

/** LIVE-3: who I follow is live right now; refreshed when someone starts or ends */
export function useFollowingLives() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const socket = connectSocket();
    const refresh = () => void queryClient.invalidateQueries({ queryKey: liveKeys.all });
    socket.on(ServerEvent.LIVE_STARTED, refresh);
    socket.on(ServerEvent.LIVE_ENDED, refresh);
    return () => {
      socket.off(ServerEvent.LIVE_STARTED, refresh);
      socket.off(ServerEvent.LIVE_ENDED, refresh);
    };
  }, [queryClient]);
  return useQuery({ queryKey: liveKeys.following(), queryFn: getLives, staleTime: 30_000 });
}

export const useLiveOf = (username: string) =>
  useQuery({ queryKey: liveKeys.of(username), queryFn: () => getLiveOf(username), retry: false });

export const useStartLive = () => useMutation({ mutationFn: startLive });

export const useJoinLive = () => useMutation({ mutationFn: joinLive });

export function useEndLive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: endLive,
    onSettled: () => queryClient.invalidateQueries({ queryKey: liveKeys.all }),
  });
}
