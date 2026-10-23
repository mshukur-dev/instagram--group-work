'use client';

import type { LiveJoin } from '@instagram/shared';
import { LiveKitRoom } from '@livekit/components-react';
import { Radio, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/user-avatar';
import { useMe } from '@/features/profile/queries';
import { cn } from '@/lib/utils';
import { useEndLive, useStartLive } from '../queries';
import { LiveFrame, LiveNotice, liveButton } from './live-frame';
import { LiveStage } from './live-stage';

type Phase = 'setup' | 'live' | 'ended';

// LIVE-1 / LIVE-6: the host's side. First a mirror of the camera and "Go live"; then the live
// itself (the same stage viewers see, with "End" instead of the cross); ending asks first and
// finishes on a short summary.
export function HostStudio() {
  const t = useTranslations('live');
  const router = useRouter();
  const start = useStartLive();
  const end = useEndLive();
  const [phase, setPhase] = useState<Phase>('setup');
  const [join, setJoin] = useState<LiveJoin | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [minutes, setMinutes] = useState(0);
  const { data: me } = useMe();

  const goLive = () =>
    start.mutate(undefined, {
      onSuccess: (data) => {
        setJoin(data);
        setPhase('live');
      },
      onError: () => toast.error(t('startFailed')),
    });

  const finish = () => {
    if (!join) return;
    end.mutate(join.live.id, {
      onSettled: () => {
        setConfirmEnd(false);
        setMinutes(
          Math.max(1, Math.round((Date.now() - Date.parse(join.live.startedAt)) / 60_000)),
        );
        setPhase('ended');
      },
    });
  };

  return (
    <LiveFrame backdrop={me?.avatarUrl}>
      {phase === 'setup' && (
        <Setup
          avatarUrl={me?.avatarUrl ?? null}
          onGoLive={goLive}
          starting={start.isPending}
          onClose={() => router.back()}
        />
      )}

      {phase === 'live' && join && (
        <LiveKitRoom
          serverUrl={join.url}
          token={join.token}
          connect
          audio
          video
          onMediaDeviceFailure={() => toast.error(t('deviceFailed'))}
          className="absolute inset-0"
        >
          <LiveStage live={join.live} isHost onClose={() => setConfirmEnd(true)} />
        </LiveKitRoom>
      )}

      {phase === 'ended' && (
        <LiveNotice
          title={t('endedTitleHost')}
          body={t('endedBodyHost', { count: minutes })}
          action={
            <button
              type="button"
              onClick={() => router.push('/')}
              className={cn(liveButton, 'bg-white text-black hover:bg-white/85')}
            >
              {t('done')}
            </button>
          }
        />
      )}

      {/* "End live video?" */}
      <AnimatePresence>
        {confirmEnd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-20 grid place-items-center bg-black/60 p-6 backdrop-blur-sm"
          >
            <motion.div
              role="alertdialog"
              aria-labelledby="end-live-title"
              initial={{ scale: 0.92, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="w-full max-w-72 overflow-hidden rounded-2xl bg-neutral-900 text-center shadow-2xl"
            >
              <div className="px-6 pt-6 pb-5">
                <h2 id="end-live-title" className="text-lg font-semibold">
                  {t('endConfirmTitle')}
                </h2>
                <p className="mt-1 text-sm text-white/65">{t('endConfirmBody')}</p>
              </div>
              <button
                type="button"
                onClick={finish}
                disabled={end.isPending}
                className="w-full border-t border-white/10 py-3 text-sm font-bold text-like outline-none transition-colors hover:bg-white/5 focus-visible:bg-white/10"
              >
                {t('endConfirm')}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmEnd(false)}
                className="w-full border-t border-white/10 py-3 text-sm outline-none transition-colors hover:bg-white/5 focus-visible:bg-white/10"
              >
                {t('cancel')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </LiveFrame>
  );
}

/** Before going live: the camera as a mirror, a word on who gets told, and the button */
function Setup({
  avatarUrl,
  onGoLive,
  starting,
  onClose,
}: {
  avatarUrl: string | null;
  onGoLive: () => void;
  starting: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('live');
  const video = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let alive = true;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((media) => {
        if (!alive) return media.getTracks().forEach((track) => track.stop());
        stream = media;
        if (video.current) video.current.srcObject = media;
      })
      .catch(() => setBlocked(true));
    return () => {
      alive = false;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <>
      <video
        ref={video}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 size-full -scale-x-100 object-cover"
      />
      {blocked && (
        <div className="absolute inset-x-8 top-1/2 flex -translate-y-2/3 flex-col items-center gap-4 text-center">
          <span className="grid place-items-center rounded-full bg-live p-0.75 shadow-[0_0_40px_-6px_color-mix(in_oklab,var(--like)_55%,transparent)]">
            <span className="grid place-items-center rounded-full bg-neutral-950 p-1">
              <UserAvatar src={avatarUrl} alt="" size={104} />
            </span>
          </span>
          <p className="max-w-60 text-sm text-white/70">{t('cameraBlocked')}</p>
        </div>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label={t('close')}
        className="absolute top-3 right-3 grid size-9 place-items-center rounded-full outline-none transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <X className="size-6 drop-shadow" />
      </button>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 bg-linear-to-t from-black/75 via-black/35 to-transparent px-6 pt-28 pb-10 text-center">
        <p className="max-w-64 text-sm text-white/80">{t('setupHint')}</p>
        <motion.button
          type="button"
          onClick={onGoLive}
          disabled={starting}
          whileTap={{ scale: 0.95 }}
          className={cn(
            liveButton,
            'flex items-center gap-2 bg-live px-7 py-3 text-base shadow-[0_8px_30px_-6px_color-mix(in_oklab,var(--like)_60%,transparent)] hover:brightness-110 disabled:opacity-70',
          )}
        >
          <Radio className={cn('size-5', starting && 'animate-pulse')} />
          {starting ? t('starting') : t('goLive')}
        </motion.button>
      </div>
    </>
  );
}
