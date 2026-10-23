'use client';

import {
  isTrackReference,
  LiveKitRoom,
  RoomAudioRenderer,
  type TrackReferenceOrPlaceholder,
  useIsMuted,
  useIsSpeaking,
  useLocalParticipant,
  useTracks,
  VideoTrack,
} from '@livekit/components-react';
import { type LocalVideoTrack, type Participant, Track } from 'livekit-client';
import { Mic, MicOff, PhoneOff, SwitchCamera, Video, VideoOff } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/user-avatar';
import { cldUrl } from '@/lib/cloudinary';
import { startRingback } from '@/lib/tones';
import { useIsPhone } from '@/lib/use-viewport';
import { cn } from '@/lib/utils';
import { type CallSession, useCallStore } from '../call-store';
import { useCallActions } from '../queries';

const CAMERA = [{ source: Track.Source.Camera, withPlaceholder: true }] as const;

const avatarOf = (participant: Participant): string | null => {
  try {
    const meta = JSON.parse(participant.metadata ?? '{}') as { avatarUrl?: string | null };
    return meta.avatarUrl ?? null;
  } catch {
    return null;
  }
};

const useTicker = (from: number | null) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!from) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [from]);
  if (!from) return null;
  const total = Math.max(0, Math.floor((now - from) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

// CALL-1…CALL-7: the call itself, over the whole app. 1:1: the other person fills the screen,
// I'm a small window that can be dragged around. A group: a grid where whoever speaks lights
// up. Controls float at the bottom. Video and sound go through LiveKit, never our API.
export function CallScreen() {
  const session = useCallStore((s) => s.session);
  const { hangUp } = useCallActions();
  const t = useTranslations('calls');
  const phase = session?.phase;

  // The caller hears ring-back until they pick up
  useEffect(() => {
    if (phase !== 'ringing') return;
    return startRingback();
  }, [phase]);

  if (!session) return null;
  const connect = session.phase === 'ringing' || session.phase === 'active';

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={session.type === 'VIDEO' ? t('videoCall') : t('audioCall')}
      initial={{ opacity: 0, scale: 1.03 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-95 overflow-hidden bg-neutral-950 text-white"
    >
      <LiveKitRoom
        serverUrl={session.url}
        token={session.token}
        connect={connect}
        audio
        video={session.type === 'VIDEO'}
        onMediaDeviceFailure={() => toast.error(t('deviceFailed'))}
        onError={() => toast.error(t('failed'))}
        className="relative size-full"
      >
        <RoomAudioRenderer />
        <Stage session={session} />
        <TopBar session={session} />
        <Controls session={session} onHangUp={hangUp} />
      </LiveKitRoom>
    </motion.div>,
    document.body,
  );
}

function Stage({ session }: { session: CallSession }) {
  const tracks = useTracks([...CAMERA], { onlySubscribed: false });
  const local = tracks.find((r) => r.participant.isLocal);
  const remotes = tracks.filter((r) => !r.participant.isLocal);
  const stage = useRef<HTMLDivElement>(null);

  if (session.phase === 'active' && session.isGroup) {
    return <Grid tracks={local ? [...remotes, local] : remotes} />;
  }
  const remote = remotes[0];
  if (session.phase !== 'active' || !remote) return <Waiting session={session} local={local} />;

  return (
    <div ref={stage} className="absolute inset-0">
      <MainTile trackRef={remote} />
      {local && <SelfView trackRef={local} bounds={stage} />}
    </div>
  );
}

/** Before the other person is there: their face, my camera behind it, and what is happening */
function Waiting({
  session,
  local,
}: {
  session: CallSession;
  local: TrackReferenceOrPlaceholder | undefined;
}) {
  const t = useTranslations('calls');
  const reduceMotion = useReducedMotion();
  const cameraOn = local && isTrackReference(local) && !local.publication.isMuted;
  const picture = session.peer?.avatarUrl ?? session.avatarUrls[0] ?? null;

  let status = t('connecting');
  if (session.phase === 'ringing') status = t('calling');
  if (session.phase === 'busy') status = t('busy', { username: session.title });
  if (session.phase === 'ended') status = t('ended');
  if (session.phase === 'active' && session.isGroup) status = t('waiting');

  return (
    <div className="absolute inset-0 grid place-items-center">
      {cameraOn && local && isTrackReference(local) ? (
        <VideoTrack
          trackRef={local}
          className="absolute inset-0 size-full -scale-x-100 object-cover opacity-60"
        />
      ) : (
        <Backdrop src={picture} />
      )}
      <span aria-hidden="true" className="absolute inset-0 bg-black/35" />

      <div className="relative flex flex-col items-center text-center">
        <span className="relative grid place-items-center">
          {session.phase === 'ringing' &&
            !reduceMotion &&
            [0, 1, 2].map((i) => (
              <motion.span
                key={i}
                aria-hidden="true"
                className="absolute size-28 rounded-full bg-white/15"
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 2.2, opacity: 0 }}
                transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
              />
            ))}
          <UserAvatar src={picture} alt="" size={112} />
        </span>
        <p className="mt-6 text-2xl font-semibold">{session.title}</p>
        <motion.p
          key={status}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 text-[15px] text-white/75"
        >
          {status}
        </motion.p>
      </div>
    </div>
  );
}

function Backdrop({ src }: { src: string | null }) {
  return src ? (
    <img
      src={cldUrl(src, 'w_200,f_auto,q_auto')}
      alt=""
      aria-hidden="true"
      className="absolute inset-0 size-full scale-125 object-cover opacity-45 blur-3xl"
    />
  ) : (
    <span aria-hidden="true" className="absolute inset-0 bg-neutral-900" />
  );
}

/** One person: their video, or (camera off / audio call) their face glowing while they talk */
function Face({
  trackRef,
  size,
  mirror,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  size: number;
  mirror?: boolean;
}) {
  const muted = useIsMuted(trackRef);
  const speaking = useIsSpeaking(trackRef.participant);
  const avatar = avatarOf(trackRef.participant);

  if (isTrackReference(trackRef) && !muted) {
    return (
      <VideoTrack
        trackRef={trackRef}
        className={cn('absolute inset-0 size-full object-cover', mirror && '-scale-x-100')}
      />
    );
  }
  return (
    <div className="absolute inset-0 grid place-items-center overflow-hidden">
      <Backdrop src={avatar} />
      <span className="relative grid place-items-center">
        <motion.span
          aria-hidden="true"
          className="absolute rounded-full bg-white/20"
          style={{ width: size, height: size }}
          animate={{ scale: speaking ? 1.25 : 1, opacity: speaking ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        />
        <UserAvatar src={avatar} alt="" size={size} />
      </span>
    </div>
  );
}

function MainTile({ trackRef }: { trackRef: TrackReferenceOrPlaceholder }) {
  return (
    <div className="absolute inset-0">
      <Face trackRef={trackRef} size={128} />
    </div>
  );
}

/** Me, small, in a corner; can be dragged anywhere on the screen */
function SelfView({
  trackRef,
  bounds,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  bounds: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <motion.div
      drag
      dragConstraints={bounds}
      dragElastic={0.15}
      dragMomentum={false}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileDrag={{ scale: 1.04 }}
      className="absolute top-20 right-4 aspect-3/4 w-36 cursor-grab touch-none overflow-hidden rounded-2xl bg-neutral-800 shadow-2xl ring-1 ring-white/15 active:cursor-grabbing max-md:w-26"
    >
      <Face trackRef={trackRef} size={48} mirror />
    </motion.div>
  );
}

function Grid({ tracks }: { tracks: TrackReferenceOrPlaceholder[] }) {
  const t = useTranslations('calls');
  const n = tracks.length;
  const cols = n <= 1 ? 'grid-cols-1' : n <= 4 ? 'grid-cols-2' : 'grid-cols-3';
  return (
    <div
      className={cn(
        'absolute inset-0 grid auto-rows-fr gap-2 px-2 pt-18 pb-28 max-md:grid-cols-2',
        cols,
        n === 1 && 'max-md:grid-cols-1',
      )}
    >
      {tracks.map((trackRef) => (
        <Tile key={trackRef.participant.identity} trackRef={trackRef} you={t('you')} />
      ))}
      {n === 1 && (
        <p className="pointer-events-none absolute inset-x-0 bottom-32 text-center text-sm text-white/70">
          {t('waiting')}
        </p>
      )}
    </div>
  );
}

function Tile({ trackRef, you }: { trackRef: TrackReferenceOrPlaceholder; you: string }) {
  const participant = trackRef.participant;
  const speaking = useIsSpeaking(participant);
  const micMuted = useIsMuted({ participant, source: Track.Source.Microphone });
  const name = participant.isLocal ? you : participant.name || participant.identity;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      className="relative min-h-0 overflow-hidden rounded-2xl bg-neutral-800"
    >
      <Face trackRef={trackRef} size={72} mirror={participant.isLocal} />
      {/* Whoever is talking gets a bright frame (CALL-7) */}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 rounded-2xl ring-[3px] ring-emerald-400 ring-inset transition-opacity duration-200',
          speaking ? 'opacity-100' : 'opacity-0',
        )}
      />
      <span className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-xs font-medium backdrop-blur-md">
        {micMuted && <MicOff className="size-3 shrink-0" />}
        <span className="truncate">{name}</span>
      </span>
    </motion.div>
  );
}

function TopBar({ session }: { session: CallSession }) {
  const t = useTranslations('calls');
  const timer = useTicker(session.phase === 'active' ? session.answeredAt : null);
  const tracks = useTracks([...CAMERA], { onlySubscribed: false });
  let status: string | null = null;
  if (session.phase === 'active') {
    status = session.isGroup
      ? `${t('people', { count: tracks.length })}${timer ? ` · ${timer}` : ''}`
      : timer;
  }
  // The waiting screen already shows name and status in the middle
  const showTitle = session.phase === 'active';
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex h-20 items-start justify-center bg-linear-to-b from-black/55 to-transparent pt-4">
      {showTitle && (
        <div className="text-center">
          <p className="text-base font-semibold">{session.title}</p>
          {status && <p className="text-sm text-white/75 tabular-nums">{status}</p>}
        </div>
      )}
    </div>
  );
}

function Controls({ session, onHangUp }: { session: CallSession; onHangUp: () => void }) {
  const t = useTranslations('calls');
  const phone = useIsPhone();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const live = session.phase === 'ringing' || session.phase === 'active';

  const toggle = (action: () => Promise<unknown>) => () =>
    void action().catch(() => toast.error(t('deviceFailed')));

  const flip = async () => {
    const track = localParticipant.getTrackPublication(Track.Source.Camera)?.track as
      LocalVideoTrack | undefined;
    const next = facing === 'user' ? 'environment' : 'user';
    await track?.restartTrack({ facingMode: next });
    setFacing(next);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: live ? 1 : 0.4, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30, delay: 0.1 }}
      className="absolute inset-x-0 bottom-0 flex justify-center pb-[max(env(safe-area-inset-bottom),24px)]"
    >
      <div className="flex items-center gap-3 rounded-full bg-white/10 p-2 shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl">
        <ControlButton
          label={isCameraEnabled ? t('cameraOff') : t('cameraOn')}
          off={!isCameraEnabled}
          disabled={!live}
          onClick={toggle(() => localParticipant.setCameraEnabled(!isCameraEnabled))}
        >
          {isCameraEnabled ? <Video className="size-6" /> : <VideoOff className="size-6" />}
        </ControlButton>
        <ControlButton
          label={isMicrophoneEnabled ? t('mute') : t('unmute')}
          off={!isMicrophoneEnabled}
          disabled={!live}
          onClick={toggle(() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled))}
        >
          {isMicrophoneEnabled ? <Mic className="size-6" /> : <MicOff className="size-6" />}
        </ControlButton>
        {phone && isCameraEnabled && (
          <ControlButton label={t('flip')} disabled={!live} onClick={toggle(flip)}>
            <SwitchCamera className="size-6" />
          </ControlButton>
        )}
        <motion.button
          type="button"
          onClick={onHangUp}
          disabled={session.phase === 'ended'}
          aria-label={t('hangUp')}
          whileTap={{ scale: 0.9 }}
          className="grid h-14 w-18 place-items-center rounded-full bg-destructive text-white outline-none transition-[filter] hover:brightness-110 focus-visible:ring-4 focus-visible:ring-white/40 disabled:opacity-60"
        >
          <PhoneOff className="size-6" />
        </motion.button>
      </div>
    </motion.div>
  );
}

function ControlButton({
  label,
  off,
  disabled,
  onClick,
  children,
}: {
  label: string;
  off?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={off}
      title={label}
      whileTap={{ scale: 0.9 }}
      className={cn(
        'grid size-14 place-items-center rounded-full outline-none transition-colors focus-visible:ring-4 focus-visible:ring-white/40 disabled:opacity-50',
        // Off reads as a white button with a dark icon, like the phone's own call screen
        off ? 'bg-white text-neutral-900' : 'bg-white/15 text-white hover:bg-white/25',
      )}
    >
      {children}
    </motion.button>
  );
}
