'use client';

import { type TrackReference, VideoTrack } from '@livekit/components-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// Above this shape difference the video is shown whole instead of cropped to fill: a phone's
// tall picture on a wide computer screen, or the other way round (docs/spec/calls.md)
const MISMATCH = 1.3;

type Insets = { top: number; bottom: number; side: number };

/**
 * A person's video that never turns into a narrow crop. When the picture and the space have
 * about the same shape it fills the space (as before). When they don't, the whole picture sits in
 * a rounded frame, and a blurred, enlarged copy of the same video fills the rest, so the colors
 * around it move with the call. `insets` keep the frame clear of the top bar and the controls.
 */
export function StageVideo({
  trackRef,
  mirror,
  insets = { top: 0, bottom: 0, side: 0 },
  rounded = 'rounded-[28px]',
}: {
  trackRef: TrackReference;
  mirror?: boolean;
  insets?: Insets;
  /** Corner radius of the frame (smaller inside a grid tile) */
  rounded?: string;
}) {
  const reduceMotion = useReducedMotion();
  const area = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [space, setSpace] = useState<{ w: number; h: number } | null>(null);
  const [ratio, setRatio] = useState<number | null>(null);

  // The space we have
  useEffect(() => {
    const element = area.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSpace({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The picture's own shape; it changes when the other person turns their phone
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const read = () => {
      if (element.videoWidth && element.videoHeight) {
        setRatio(element.videoWidth / element.videoHeight);
      }
    };
    read();
    element.addEventListener('loadedmetadata', read);
    element.addEventListener('resize', read);
    return () => {
      element.removeEventListener('loadedmetadata', read);
      element.removeEventListener('resize', read);
    };
  }, [trackRef]);

  const room = space && {
    w: Math.max(0, space.w - insets.side * 2),
    h: Math.max(0, space.h - insets.top - insets.bottom),
  };
  const roomRatio = room && room.h > 0 ? room.w / room.h : null;
  const framed =
    ratio !== null &&
    roomRatio !== null &&
    Math.max(ratio / roomRatio, roomRatio / ratio) > MISMATCH;

  // The largest box of the picture's shape that fits the room
  let frame: { w: number; h: number } | null = null;
  if (framed && room && ratio) {
    frame =
      room.w / room.h > ratio ? { w: room.h * ratio, h: room.h } : { w: room.w, h: room.w / ratio };
  }

  const flip = mirror && '-scale-x-100';

  return (
    <div ref={area} className="absolute inset-0 overflow-hidden bg-neutral-950">
      {framed && (
        <>
          {/* The same video, blurred and enlarged: a glow in the call's own colors */}
          <VideoTrack
            trackRef={trackRef}
            aria-hidden="true"
            className={cn(
              'absolute inset-0 size-full scale-125 object-cover opacity-70 blur-3xl saturate-150',
              flip,
            )}
          />
          <span aria-hidden="true" className="absolute inset-0 bg-black/35" />
        </>
      )}
      <motion.div
        initial={false}
        animate={
          frame
            ? {
                width: frame.w,
                height: frame.h,
                top: insets.top + ((room?.h ?? 0) - frame.h) / 2,
                left: insets.side + ((room?.w ?? 0) - frame.w) / 2,
              }
            : { width: '100%', height: '100%', top: 0, left: 0 }
        }
        transition={
          reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 32 }
        }
        className={cn(
          'absolute overflow-hidden',
          framed && cn(rounded, 'shadow-[0_24px_80px_rgb(0_0_0/0.55)] ring-1 ring-white/12'),
        )}
      >
        <VideoTrack
          ref={video}
          trackRef={trackRef}
          className={cn('size-full', framed ? 'object-contain' : 'object-cover', flip)}
        />
      </motion.div>
    </div>
  );
}
