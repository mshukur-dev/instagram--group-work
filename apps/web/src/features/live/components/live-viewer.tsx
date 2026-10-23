'use client';

import { ErrorCode, ServerEvent, type LiveJoin } from '@instagram/shared';
import { LiveKitRoom } from '@livekit/components-react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getErrorCode } from '@/lib/api-error';
import { connectSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { useJoinLive, useLiveOf } from '../queries';
import { LiveFrame, LiveNotice, liveButton } from './live-frame';
import { LiveStage } from './live-stage';

// LIVE-4: watching someone's live at /live/:username. It ends for the viewer when the host
// ends it (the room closes, and the live:ended event says so too).
export function LiveViewer({ username }: { username: string }) {
  const t = useTranslations('live');
  const router = useRouter();
  const live = useLiveOf(username);
  const joinLive = useJoinLive();
  const [join, setJoin] = useState<LiveJoin | null>(null);
  const [ended, setEnded] = useState(false);
  const liveId = live.data?.id;
  const { mutate } = joinLive;

  useEffect(() => {
    if (!liveId) return;
    mutate(liveId, { onSuccess: setJoin });
  }, [liveId, mutate]);

  useEffect(() => {
    if (!liveId) return;
    const socket = connectSocket();
    const onEnded = ({ liveId: id }: { liveId: string }) => id === liveId && setEnded(true);
    socket.on(ServerEvent.LIVE_ENDED, onEnded);
    return () => {
      socket.off(ServerEvent.LIVE_ENDED, onEnded);
    };
  }, [liveId]);

  const leave = () => (window.history.length > 1 ? router.back() : router.push('/'));
  const back = (
    <button
      type="button"
      onClick={leave}
      className={cn(liveButton, 'bg-white text-black hover:bg-white/85')}
    >
      {t('back')}
    </button>
  );

  const error = live.error ?? joinLive.error;
  const code = error ? getErrorCode(error) : null;

  let content: React.ReactNode;
  if (ended || code === ErrorCode.LIVE_ENDED || code === ErrorCode.LIVE_NOT_FOUND) {
    content = <LiveNotice title={t('endedTitle')} body={t('endedBody')} action={back} />;
  } else if (code === ErrorCode.PRIVATE_ACCOUNT) {
    content = <LiveNotice title={t('privateTitle')} body={t('privateBody')} action={back} />;
  } else if (error) {
    content = <LiveNotice title={t('loadFailed')} action={back} />;
  } else if (!join) {
    content = (
      <div className="absolute inset-0 grid place-items-center">
        <Loader2 className="size-7 animate-spin text-white/70" />
      </div>
    );
  } else {
    content = (
      <LiveKitRoom
        serverUrl={join.url}
        token={join.token}
        connect
        audio={false}
        video={false}
        onDisconnected={() => setEnded(true)}
        className="absolute inset-0"
      >
        <LiveStage live={join.live} isHost={false} onClose={leave} />
      </LiveKitRoom>
    );
  }

  return <LiveFrame>{content}</LiveFrame>;
}
