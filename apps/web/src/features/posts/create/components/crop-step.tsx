'use client';

import { GalleryHorizontalEnd, Plus, X, ZoomIn } from 'lucide-react';
import { AnimatePresence, motion, Reorder, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import { cn } from '@/lib/utils';
import { ACCEPT, ASPECTS, type AspectKey, type DraftMedia } from '../draft';

type Props = {
  items: DraftMedia[];
  active: DraftMedia;
  aspectKey: AspectKey;
  onSelect: (id: string) => void;
  onAspect: (key: AspectKey) => void;
  onChange: (id: string, patch: Partial<DraftMedia>) => void;
  onRemove: (id: string) => void;
  onReorder: (items: DraftMedia[]) => void;
  onFiles: (files: File[]) => void;
};

// Floating controls sit on the photo, so they stay dark glass in both themes
const glass = 'bg-black/55 text-white backdrop-blur-md';

export function CropStep({
  items,
  active,
  aspectKey,
  onSelect,
  onAspect,
  onChange,
  onRemove,
  onReorder,
  onFiles,
}: Props) {
  const t = useTranslations('createPost');
  const reduceMotion = useReducedMotion();
  const [railOpen, setRailOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const aspect = ASPECTS.find((a) => a.key === aspectKey)?.value ?? 1;
  const hasPhotos = items.some((item) => item.type === 'IMAGE');
  const full = items.length >= 10;

  return (
    <div className="bg-muted relative size-full overflow-hidden">
      {active.type === 'IMAGE' ? (
        <Cropper
          key={active.id}
          image={active.url}
          crop={active.crop}
          zoom={active.zoom}
          minZoom={1}
          maxZoom={3}
          aspect={aspect}
          showGrid={false}
          onCropChange={(crop) => onChange(active.id, { crop })}
          onZoomChange={(zoom) => onChange(active.id, { zoom })}
          onCropComplete={(areaPercent, areaPixels) => onChange(active.id, { areaPercent, areaPixels })}
          classes={{ containerClassName: 'bg-muted' }}
        />
      ) : (
        // Videos are uploaded as they are (POST-2 covers photos only)
        <video
          key={active.id}
          src={active.url}
          className="size-full bg-black object-contain"
          autoPlay
          muted
          loop
          playsInline
        />
      )}

      {/* Bottom left: aspect ratio and zoom */}
      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2">
        {hasPhotos && active.type === 'IMAGE' && (
          <>
            <div role="radiogroup" aria-label={t('aspect')} className={cn('flex rounded-full p-1', glass)}>
              {ASPECTS.map(({ key, value }) => {
                const selected = key === aspectKey;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onAspect(key)}
                    className={cn(
                      'relative flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold outline-none transition-colors',
                      'focus-visible:ring-2 focus-visible:ring-white/70',
                      selected ? 'text-black' : 'text-white/80 hover:text-white',
                    )}
                  >
                    {selected && (
                      <motion.span
                        layoutId="aspect-pill"
                        transition={
                          reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 38 }
                        }
                        className="absolute inset-0 rounded-full bg-white"
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className="relative rounded-[2px] border-[1.5px] border-current"
                      style={{ width: value >= 1 ? 14 : 14 * value, height: value >= 1 ? 14 / value : 14 }}
                    />
                    <span className="relative">{key}</span>
                  </button>
                );
              })}
            </div>

            <label className={cn('flex h-10 items-center gap-2 rounded-full pr-4 pl-3', glass)}>
              <ZoomIn className="size-4 shrink-0" aria-hidden="true" />
              <span className="sr-only">{t('zoom')}</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={active.zoom}
                onChange={(event) => onChange(active.id, { zoom: Number(event.target.value) })}
                className="h-1 w-24 cursor-pointer accent-white"
              />
            </label>
          </>
        )}
      </div>

      {/* Bottom right: the carousel (reorder, remove, add) */}
      <div className="absolute right-3 bottom-3 flex flex-col items-end gap-2">
        <AnimatePresence>
          {railOpen && (
            <motion.div
              key="rail"
              initial={{ opacity: 0, scale: 0.92, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 8 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformOrigin: 'bottom right' }}
              className={cn(
                'flex max-w-[calc(100vw-5rem)] items-center gap-1 rounded-2xl p-1.5',
                // Keeps the rail inside the dialog: it scrolls (without a visible bar) when it is full
                'sm:max-w-[536px]',
                glass,
              )}
            >
              <Reorder.Group
                axis="x"
                values={items}
                onReorder={onReorder}
                // Padding keeps the dot and the shadows inside the scroll box; the bar is hidden,
                // the edges fade out instead
                className={cn(
                  'flex min-w-0 items-start gap-2 overflow-x-auto px-1.5 pt-1 pb-3',
                  '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                  '[mask-image:linear-gradient(to_right,transparent,black_8px,black_calc(100%-8px),transparent)]',
                )}
              >
                {items.map((item) => {
                  const selected = item.id === active.id;
                  return (
                    <Reorder.Item
                      key={item.id}
                      value={item}
                      layout="position"
                      className="group relative shrink-0 cursor-grab active:cursor-grabbing"
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(item.id)}
                        aria-label={t('selectItem')}
                        aria-current={selected}
                        className={cn(
                          'block size-12 overflow-hidden rounded-lg outline-none transition-[opacity,transform] duration-200',
                          'focus-visible:ring-2 focus-visible:ring-white/70',
                          selected ? 'opacity-100' : 'scale-[0.92] opacity-55 hover:scale-100 hover:opacity-90',
                        )}
                      >
                        {item.type === 'IMAGE' ? (
                          <img src={item.url} alt="" draggable={false} className="size-full object-cover" />
                        ) : (
                          <video src={item.url} muted className="size-full object-cover" />
                        )}
                      </button>

                      {/* Selected marker: a dot that slides between the thumbnails */}
                      {selected && (
                        <motion.span
                          layoutId="rail-dot"
                          aria-hidden="true"
                          transition={
                            reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 38 }
                          }
                          className="absolute -bottom-2 left-1/2 size-1 -translate-x-1/2 rounded-full bg-white"
                        />
                      )}

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemove(item.id)}
                          aria-label={t('remove')}
                          className={cn(
                            'absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-black/70 text-white outline-none',
                            'transition-opacity hover:bg-black focus-visible:ring-2 focus-visible:ring-white',
                            // Hidden until the thumbnail is hovered or focused (always there on touch screens)
                            'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100',
                          )}
                        >
                          <X className="size-2.5" strokeWidth={3} />
                        </button>
                      )}
                    </Reorder.Item>
                  );
                })}
              </Reorder.Group>

              {!full && (
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  aria-label={t('addMore')}
                  className="mt-1 grid size-12 shrink-0 place-items-center self-start rounded-lg border border-dashed border-white/40 text-white/70 outline-none transition-colors hover:border-white/80 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  <Plus className="size-5" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setRailOpen((open) => !open)}
          aria-label={t('gallery')}
          aria-expanded={railOpen}
          className={cn(
            'relative grid size-10 place-items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/70',
            railOpen ? 'bg-white text-black' : glass,
          )}
        >
          <GalleryHorizontalEnd className="size-[18px]" />
          {items.length > 1 && !railOpen && (
            <span className="bg-brand text-brand-foreground absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full px-1 text-[10px] leading-4 font-semibold">
              {items.length}
            </span>
          )}
        </button>
      </div>

      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
    </div>
  );
}
