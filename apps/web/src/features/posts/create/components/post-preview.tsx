'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useId, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { canEdit, type DraftMedia } from '../draft';
import {
  editLook,
  isEdited,
  overlayBackground,
  vignetteBackground,
  type EditLook,
  type Matrix,
} from '../filters';

/** An SVG color matrix that HTML can use as `filter: url(#id)` */
export function MatrixFilter({ id, matrix }: { id: string; matrix: Matrix }) {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute">
      <filter id={id} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values={matrix.map((v) => v.toFixed(4)).join(' ')} />
      </filter>
    </svg>
  );
}

/** The tint and the vignette that sit on top of the photo */
export function LookLayers({ look }: { look: EditLook }) {
  return (
    <>
      {look.overlay && look.overlayOpacity > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: overlayBackground(look.overlay),
            mixBlendMode: look.overlay.blend,
            opacity: look.overlayOpacity,
          }}
        />
      )}
      {look.vignette > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: vignetteBackground(look.vignette) }}
        />
      )}
    </>
  );
}

/** A DOM-safe id for `url(#…)` (React's ids carry characters a URL fragment can't) */
export const useFilterId = () => `f${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

// Shows the photo exactly as it will be posted: cropped (the full image is scaled up and
// shifted inside a box with the crop's aspect ratio) and with its filter and adjustments.
function EditedMedia({ item, original }: { item: DraftMedia; original: boolean }) {
  const filterId = useFilterId();
  if (item.type === 'VIDEO') {
    return (
      <video src={item.url} className="size-full object-cover" autoPlay muted loop playsInline />
    );
  }
  const look = !original && canEdit(item) && isEdited(item.edit) ? editLook(item.edit) : null;
  const filter: CSSProperties = look ? { filter: `url(#${filterId})` } : {};
  const area = item.areaPercent;
  return (
    <>
      {look && <MatrixFilter id={filterId} matrix={look.matrix} />}
      {area ? (
        <img
          src={item.url}
          alt=""
          draggable={false}
          className="absolute max-w-none"
          style={{
            width: `${10000 / area.width}%`,
            left: `${-(area.x / area.width) * 100}%`,
            top: `${-(area.y / area.height) * 100}%`,
            aspectRatio: item.width / item.height,
            ...filter,
          }}
        />
      ) : (
        <img
          src={item.url}
          alt=""
          draggable={false}
          className="size-full object-cover"
          style={filter}
        />
      )}
      {look && <LookLayers look={look} />}
    </>
  );
}

type Props = {
  items: DraftMedia[];
  aspect: number;
  index: number;
  onIndex: (index: number) => void;
  /** Hold-to-compare: the photo without its edit */
  original?: boolean;
  onHold?: (holding: boolean) => void;
};

/** The post as it will look: a box with the crop's shape, arrows and dots for a carousel */
export function PostPreview({ items, aspect, index, onIndex, original = false, onHold }: Props) {
  const t = useTranslations('createPost');
  const reduceMotion = useReducedMotion();
  const current = items[Math.min(index, items.length - 1)] ?? items[0];
  if (!current) return null;

  const hold = onHold
    ? {
        onPointerDown: (event: React.PointerEvent) => {
          if (event.button === 0) onHold(true);
        },
        onPointerUp: () => onHold(false),
        onPointerLeave: () => onHold(false),
        onPointerCancel: () => onHold(false),
      }
    : {};

  return (
    <div className="bg-muted relative min-h-0 min-w-0 flex-1 @container-size">
      <div className="absolute inset-0 grid place-items-center">
        <div
          className="relative overflow-hidden select-none"
          style={{ width: `min(100cqw, calc(100cqh * ${aspect}))`, aspectRatio: aspect }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.25 }}
              className="absolute inset-0"
              {...hold}
            >
              <EditedMedia item={current} original={original} />
            </motion.div>
          </AnimatePresence>

          {items.length > 1 && (
            <>
              {index > 0 && (
                <button
                  type="button"
                  aria-label={t('previous')}
                  onClick={() => onIndex(index - 1)}
                  className="bg-background/80 absolute top-1/2 left-2 grid size-7 -translate-y-1/2 place-items-center rounded-full shadow-sm outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronLeft className="size-4" />
                </button>
              )}
              {index < items.length - 1 && (
                <button
                  type="button"
                  aria-label={t('next')}
                  onClick={() => onIndex(index + 1)}
                  className="bg-background/80 absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full shadow-sm outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronRight className="size-4" />
                </button>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1">
                {items.map((item, i) => (
                  <span
                    key={item.id}
                    className={cn(
                      'size-1.5 rounded-full transition-colors duration-200',
                      i === index ? 'bg-white' : 'bg-white/50',
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
