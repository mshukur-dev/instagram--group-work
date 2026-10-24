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
import { Mic, MicOff, PhoneOff, Pin, SwitchCamera, Video, VideoOff } from 'lucide-react';
import {
  animate,
  LayoutGroup,
  motion,
  type PanInfo,
  useMotionValue,
  useReducedMotion,
} from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/user-avatar';
import { cldUrl } from '@/lib/cloudinary';
import { startRingback } from '@/lib/tones';
import { useIsPhone } from '@/lib/use-viewport';
import { cn } from '@/lib/utils';
import { type CallSession, useCallStore } from '../call-store';
import { useCallActions } from '../queries';
import { StageVideo } from './stage-video';

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
  // 1:1: a tap on the small window swaps who is big
  const [swapped, setSwapped] = useState(false);

  if (session.phase === 'active' && session.isGroup) {
    return <Grid tracks={local ? [...remotes, local] : remotes} />;
  }
  const remote = remotes[0];
  if (session.phase !== 'active' || !remote) return <Waiting session={session} local={local} />;
  const big = swapped && local ? local : remote;
  const small = swapped && local ? remote : local;

  return (
    <div ref={stage} className="absolute inset-0">
      <MainTile trackRef={big} />
      {small && <SelfView trackRef={small} bounds={stage} onSwap={() => setSwapped((v) => !v)} />}
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

type StageInsets = { top: number; bottom: number; side: number };

/**
 * One person: their video, or (camera off / audio call) their face glowing while they talk.
 * With `stage` the video is never cropped to a narrow strip (StageVideo); small windows fill.
 */
function Face({
  trackRef,
  size,
  mirror,
  stage,
  rounded,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  size: number;
  mirror?: boolean;
  stage?: StageInsets;
  rounded?: string;
}) {
  const muted = useIsMuted(trackRef);
  // My own picture is mirrored like a selfie, but not from the back camera
  const facing = useCallStore((state) => state.cameraFacing);
  const flip = Boolean(mirror) && facing === 'user';
  const speaking = useIsSpeaking(trackRef.participant);
  const avatar = avatarOf(trackRef.participant);

  if (isTrackReference(trackRef) && !muted) {
    if (stage) {
      return <StageVideo trackRef={trackRef} mirror={flip} insets={stage} rounded={rounded} />;
    }
    return (
      <VideoTrack
        trackRef={trackRef}
        className={cn('absolute inset-0 size-full object-cover', flip && '-scale-x-100')}
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

// The big picture keeps clear of the title on top and the controls below
const MAIN_STAGE: StageInsets = { top: 84, bottom: 124, side: 32 };
const MAIN_STAGE_PHONE: StageInsets = { top: 72, bottom: 112, side: 12 };
const TILE_STAGE: StageInsets = { top: 6, bottom: 6, side: 6 };

function MainTile({ trackRef }: { trackRef: TrackReferenceOrPlaceholder }) {
  const phone = useIsPhone();
  return (
    <div className="absolute inset-0">
      <Face
        trackRef={trackRef}
        size={128}
        mirror={trackRef.participant.isLocal}
        stage={phone ? MAIN_STAGE_PHONE : MAIN_STAGE}
      />
    </div>
  );
}

// Where the small window may rest: the four corners, clear of the top bar and the controls
type Corner = 'tl' | 'tr' | 'bl' | 'br';
const EDGE = 20;
const TOP_GAP = 84;
const BOTTOM_GAP = 120;
const SNAP = { type: 'spring', stiffness: 420, damping: 34 } as const;

/**
 * The small window (me, or them after a swap). Dragged anywhere, it flies to the nearest corner
 * when let go, a quick flick carrying it towards where it was thrown. A tap swaps who is big.
 */
function SelfView({
  trackRef,
  bounds,
  onSwap,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  bounds: React.RefObject<HTMLDivElement | null>;
  onSwap: () => void;
}) {
  const t = useTranslations('calls');
  const box = useRef<HTMLDivElement>(null);
  const corner = useRef<Corner>('tr');
  // Hidden until it has its place, so it never flashes in the top-left corner first
  const [placed, setPlaced] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const spotOf = (c: Corner) => {
    const area = bounds.current;
    const el = box.current;
    // Not laid out yet: no place to compute (it would land flush in the corner)
    if (!area || !el || !area.clientWidth || !el.offsetWidth) return null;
    return {
      x: c.endsWith('l') ? EDGE : area.clientWidth - el.offsetWidth - EDGE,
      y: c.startsWith('t') ? TOP_GAP : area.clientHeight - el.offsetHeight - BOTTOM_GAP,
    };
  };

  // In its corner, with the margins, as soon as the screen and the window have their real
  // sizes, and again whenever either changes (window resized, phone turned)
  useLayoutEffect(() => {
    const place = () => {
      const spot = spotOf(corner.current);
      if (!spot) return;
      x.set(spot.x);
      y.set(spot.y);
      setPlaced(true);
    };
    place();
    const frame = requestAnimationFrame(place);
    const observer = new ResizeObserver(place);
    if (bounds.current) observer.observe(bounds.current);
    if (box.current) observer.observe(box.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onDragEnd = (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const area = bounds.current;
    const el = box.current;
    if (!area || !el) return;
    // Where it would coast to: a flick counts, not only where the finger stopped
    const cx = x.get() + info.velocity.x * 0.18 + el.offsetWidth / 2;
    const cy = y.get() + info.velocity.y * 0.18 + el.offsetHeight / 2;
    const next: Corner = `${cy < area.clientHeight / 2 ? 't' : 'b'}${cx < area.clientWidth / 2 ? 'l' : 'r'}`;
    corner.current = next;
    const spot = spotOf(next);
    if (!spot) return;
    void animate(x, spot.x, { ...SNAP, velocity: info.velocity.x });
    void animate(y, spot.y, { ...SNAP, velocity: info.velocity.y });
  };

  return (
    <motion.div
      ref={box}
      role="button"
      tabIndex={0}
      aria-label={t('swap')}
      title={t('swap')}
      // onTap does not fire after a drag, so dragging never swaps by accident
      onTap={onSwap}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSwap();
        }
      }}
      drag
      dragMomentum={false}
      onDragEnd={onDragEnd}
      style={{ x, y }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={placed ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      whileDrag={{ scale: 1.06, cursor: 'grabbing' }}
      className="absolute top-0 left-0 z-10 aspect-3/4 w-36 cursor-grab touch-none overflow-hidden rounded-2xl bg-neutral-800 shadow-2xl ring-1 ring-white/15 outline-none focus-visible:ring-2 focus-visible:ring-white/60 max-md:w-26"
    >
      {/* The video must not take the pointer, or the drag would not start on it */}
      <div className="pointer-events-none absolute inset-0">
        <Face trackRef={trackRef} size={48} mirror={trackRef.participant.isLocal} />
      </div>
    </motion.div>
  );
}

// A group: everyone in a grid. A click on someone puts them big on top with the rest in a
// strip below; a click on them again goes back to the grid.
function Grid({ tracks }: { tracks: TrackReferenceOrPlaceholder[] }) {
  const t = useTranslations('calls');
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const n = tracks.length;
  const pinned = n > 1 ? tracks.find((r) => r.participant.identity === pinnedId) : undefined;
  const toggle = (id: string) => setPinnedId((current) => (current === id ? null : id));

  if (pinned) {
    const others = tracks.filter((r) => r !== pinned);
    return (
      <LayoutGroup>
        <div className="absolute inset-0 flex flex-col gap-2 px-2 pt-18 pb-28">
          <div className="grid min-h-0 flex-1">
            <Tile trackRef={pinned} you={t('you')} pinned onToggle={toggle} />
          </div>
          <div className="flex h-28 shrink-0 justify-center gap-2 overflow-x-auto max-md:h-22">
            {others.map((trackRef) => (
              <Tile
                key={trackRef.participant.identity}
                trackRef={trackRef}
                you={t('you')}
                small
                onToggle={toggle}
                className="aspect-4/3 h-full shrink-0"
              />
            ))}
          </div>
        </div>
      </LayoutGroup>
    );
  }

  const cols = n <= 1 ? 'grid-cols-1' : n <= 4 ? 'grid-cols-2' : 'grid-cols-3';
  // A phone held upright: two people stacked (side by side would be two thin strips), three as
  // one wide on top and two below, more in two columns
  return (
    <LayoutGroup>
      <div
        className={cn(
          'absolute inset-0 grid auto-rows-fr gap-2 px-2 pt-18 pb-28',
          cols,
          n <= 2 ? 'max-md:grid-cols-1' : 'max-md:grid-cols-2',
        )}
      >
        {tracks.map((trackRef, i) => (
          <Tile
            key={trackRef.participant.identity}
            trackRef={trackRef}
            you={t('you')}
            onToggle={n > 1 ? toggle : undefined}
            className={n === 3 && i === 0 ? 'max-md:col-span-2' : undefined}
          />
        ))}
        {n === 1 && (
          <p className="pointer-events-none absolute inset-x-0 bottom-32 text-center text-sm text-white/70">
            {t('waiting')}
          </p>
        )}
      </div>
    </LayoutGroup>
  );
}

function Tile({
  trackRef,
  you,
  pinned,
  small,
  onToggle,
  className,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  you: string;
  pinned?: boolean;
  small?: boolean;
  onToggle?: (identity: string) => void;
  className?: string;
}) {
  const t = useTranslations('calls');
  const participant = trackRef.participant;
  const speaking = useIsSpeaking(participant);
  const micMuted = useIsMuted({ participant, source: Track.Source.Microphone });
  const name = participant.isLocal ? you : participant.name || participant.identity;
  const toggle = onToggle && (() => onToggle(participant.identity));
  return (
    <motion.div
      // the same tile glides between the grid, the big spot and the strip
      layoutId={participant.identity}
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 360, damping: 32 }}
      role={toggle ? 'button' : undefined}
      tabIndex={toggle ? 0 : undefined}
      aria-pressed={toggle ? Boolean(pinned) : undefined}
      aria-label={toggle ? t(pinned ? 'unpin' : 'pin', { name }) : undefined}
      onClick={toggle}
      onKeyDown={(event) => {
        if (toggle && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          toggle();
        }
      }}
      className={cn(
        'relative min-h-0 overflow-hidden rounded-2xl bg-neutral-800 outline-none focus-visible:ring-2 focus-visible:ring-white/60',
        toggle && 'cursor-pointer',
        className,
      )}
    >
      <Face
        trackRef={trackRef}
        size={small ? 40 : 72}
        mirror={participant.isLocal}
        stage={small ? undefined : TILE_STAGE}
        rounded="rounded-xl"
      />
      {/* Whoever is talking gets a bright frame (CALL-7) */}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 rounded-2xl ring-[3px] ring-emerald-400 ring-inset transition-opacity duration-200',
          speaking ? 'opacity-100' : 'opacity-0',
        )}
      />
      <span className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-xs font-medium backdrop-blur-md">
        {pinned && <Pin className="size-3 shrink-0" />}
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
  const facing = useCallStore((state) => state.cameraFacing);
  const setFacing = useCallStore((state) => state.setCameraFacing);
  // A second tap while the camera restarts would start another restart over the first one
  const [flipping, setFlipping] = useState(false);
  const live = session.phase === 'ringing' || session.phase === 'active';

  const toggle = (action: () => Promise<unknown>) => () =>
    void action().catch(() => toast.error(t('deviceFailed')));

  const flip = async () => {
    const track = localParticipant.getTrackPublication(Track.Source.Camera)?.track as
      LocalVideoTrack | undefined;
    if (!track || flipping) return;
    const next = facing === 'user' ? 'environment' : 'user';
    setFlipping(true);
    try {
      await track.restartTrack({ facingMode: next });
      // Some phones treat the wish loosely and keep the same camera: then pick it by name
      if (track.mediaStreamTrack.getSettings().facingMode !== next) {
        const cameras = (await navigator.mediaDevices.enumerateDevices()).filter(
          (d) => d.kind === 'videoinput',
        );
        const wanted =
          next === 'environment' ? /back|rear|environment|задн/i : /front|user|передн/i;
        const current = track.mediaStreamTrack.getSettings().deviceId;
        const other =
          cameras.find((d) => wanted.test(d.label)) ?? cameras.find((d) => d.deviceId !== current);
        if (other) await track.restartTrack({ deviceId: other.deviceId });
      }
      setFacing(next);
    } finally {
      setFlipping(false);
    }
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
          <ControlButton label={t('flip')} disabled={!live || flipping} onClick={toggle(flip)}>
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
