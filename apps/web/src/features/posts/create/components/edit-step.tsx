'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { canEdit, cropArea, type DraftMedia } from '../draft';
import {
  ADJUSTMENTS,
  FILTER_KEYS,
  presetLook,
  thumbnail,
  type AdjustmentKey,
  type FilterKey,
  type PhotoEdit,
} from '../filters';
import { LookLayers, MatrixFilter, PostPreview, useFilterId } from './post-preview';

type Props = {
  items: DraftMedia[];
  aspect: number;
  onChange: (id: string, patch: Partial<DraftMedia>) => void;
};

type Tab = 'filters' | 'adjustments';

// POST-8: the "Edit" step between crop and caption, as on Instagram: the photo on the left
// (press and hold it to see the original), filters and adjustments on the right. Each photo
// of a carousel has its own edit.
export function EditStep({ items, aspect, onChange }: Props) {
  const t = useTranslations('createPost.edit');
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [tab, setTab] = useState<Tab>('filters');
  const [holding, setHolding] = useState(false);
  const current = items[Math.min(index, items.length - 1)] ?? items[0];
  if (!current) return null;

  const editable = canEdit(current);
  const edit = current.edit;
  const setEdit = (patch: Partial<PhotoEdit>) =>
    onChange(current.id, { edit: { ...edit, ...patch } });

  return (
    <div className="flex size-full max-md:flex-col">
      <PostPreview
        items={items}
        aspect={aspect}
        index={index}
        onIndex={setIndex}
        original={holding}
        onHold={editable ? setHolding : undefined}
      />

      <aside className="border-border/50 flex w-85 shrink-0 flex-col border-l max-md:max-h-72 max-md:w-full max-md:border-t max-md:border-l-0">
        {editable ? (
          <>
            <div role="tablist" className="border-border/50 grid shrink-0 grid-cols-2 border-b">
              {(['filters', 'adjustments'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={cn(
                    'relative h-11 text-sm font-semibold outline-none transition-colors focus-visible:bg-foreground/4',
                    tab === key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t(key)}
                  {tab === key && (
                    <motion.span
                      layoutId="edit-tab"
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { type: 'spring', stiffness: 500, damping: 40 }
                      }
                      className="bg-foreground absolute inset-x-0 -bottom-px h-px"
                    />
                  )}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                role="tabpanel"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.12 }}
                className="flex min-h-0 flex-1 flex-col"
              >
                {tab === 'filters' ? (
                  <FiltersPanel item={current} aspect={aspect} edit={edit} onEdit={setEdit} />
                ) : (
                  <AdjustmentsPanel edit={edit} onEdit={setEdit} />
                )}
              </motion.div>
            </AnimatePresence>
          </>
        ) : (
          <p className="text-muted-foreground m-auto max-w-56 px-4 text-center text-sm">
            {t(current.type === 'VIDEO' ? 'video' : 'gif')}
          </p>
        )}
      </aside>
    </div>
  );
}

// ───────────── Filters ─────────────

function FiltersPanel({
  item,
  aspect,
  edit,
  onEdit,
}: {
  item: DraftMedia;
  aspect: number;
  edit: PhotoEdit;
  onEdit: (patch: Partial<PhotoEdit>) => void;
}) {
  const t = useTranslations('createPost.edit');
  const thumb = useThumbnail(item, aspect);
  const baseId = useFilterId();
  const looks = useMemo(() => FILTER_KEYS.map((key) => [key, presetLook(key)] as const), []);

  return (
    <>
      {looks.map(([key, look]) => (
        <MatrixFilter key={key} id={`${baseId}-${key}`} matrix={look.matrix} />
      ))}
      <div
        data-scrollable
        className="grid min-h-0 flex-1 grid-cols-3 content-start [scrollbar-width:none] gap-x-3 gap-y-4 overflow-y-auto p-4 max-md:flex max-md:overflow-x-auto max-md:overflow-y-hidden"
      >
        {looks.map(([key, look]) => {
          const selected = edit.filter === key;
          return (
            <motion.button
              key={key}
              type="button"
              aria-pressed={selected}
              whileTap={{ scale: 0.95 }}
              onClick={() => onEdit({ filter: key, strength: selected ? edit.strength : 100 })}
              className="group flex flex-col items-center gap-1.5 rounded-md outline-none max-md:w-20 max-md:shrink-0"
            >
              <span
                className={cn(
                  'bg-muted relative block aspect-square w-full overflow-hidden rounded-md ring-offset-2 ring-offset-card transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-ring',
                  selected && 'ring-brand ring-2',
                )}
              >
                {thumb && (
                  <img
                    src={thumb}
                    alt=""
                    draggable={false}
                    className="size-full object-cover"
                    style={key === 'normal' ? undefined : { filter: `url(#${baseId}-${key})` }}
                  />
                )}
                {thumb && <LookLayers look={look} />}
              </span>
              <span
                className={cn(
                  'text-xs transition-colors',
                  selected
                    ? 'text-brand font-semibold'
                    : 'text-muted-foreground group-hover:text-foreground',
                )}
              >
                {t(`filter.${key}` as FilterLabel)}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* How strong the chosen filter is */}
      <AnimatePresence initial={false}>
        {edit.filter !== 'normal' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="border-border/50 shrink-0 overflow-hidden border-t"
          >
            <div className="flex items-center gap-4 px-4 py-4">
              <Slider
                label={t('strength')}
                value={edit.strength}
                min={0}
                max={100}
                onChange={(strength) => onEdit({ strength })}
              />
              <span className="w-8 text-right text-sm tabular-nums">{edit.strength}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

type FilterLabel = `filter.${FilterKey}`;

/** A small square of the photo for the filter tiles, remade when the crop changes */
function useThumbnail(item: DraftMedia, aspect: number) {
  const area = cropArea(item, aspect);
  const key = `${item.id}:${Math.round(area.x)}:${Math.round(area.y)}:${Math.round(area.width)}`;
  const [thumb, setThumb] = useState<{ key: string; url: string } | null>(null);

  useEffect(() => {
    let alive = true;
    thumbnail(item.url, area)
      .then((url) => alive && setThumb({ key, url }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // `key` stands for the area
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, item.url]);

  return thumb?.key === key ? thumb.url : null;
}

// ───────────── Adjustments ─────────────

function AdjustmentsPanel({
  edit,
  onEdit,
}: {
  edit: PhotoEdit;
  onEdit: (patch: Partial<PhotoEdit>) => void;
}) {
  const t = useTranslations('createPost.edit');
  const set = (key: AdjustmentKey, value: number) =>
    onEdit({ adjust: { ...edit.adjust, [key]: value } });

  return (
    <div data-scrollable className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
      {ADJUSTMENTS.map(({ key, min }) => {
        const value = edit.adjust[key];
        return (
          <div key={key} className="py-3">
            <div className="flex h-6 items-center justify-between">
              <span className="text-[15px]">{t(`adjust.${key}`)}</span>
              <AnimatePresence initial={false}>
                {value !== 0 && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    onClick={() => set(key, 0)}
                    className="text-brand hover:text-brand-hover rounded-sm text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t('reset')}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            <div className="mt-2 flex items-center gap-4">
              <Slider
                label={t(`adjust.${key}`)}
                value={value}
                min={min}
                max={100}
                onChange={(next) => set(key, next)}
              />
              <span
                className={cn(
                  'w-8 text-right text-sm tabular-nums transition-colors',
                  value === 0 && 'text-muted-foreground',
                )}
              >
                {value}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A thin track filled from zero (the middle for -100..100) to the value, with a round knob */
function Slider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const at = (v: number) => ((v - min) / (max - min)) * 100;
  const from = Math.min(at(0), at(value));
  const to = Math.max(at(0), at(value));
  return (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={1}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      onDoubleClick={() => onChange(0)}
      style={{
        background: `linear-gradient(to right, var(--border) ${from}%, var(--foreground) ${from}%, var(--foreground) ${to}%, var(--border) ${to}%)`,
      }}
      className="h-0.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full outline-none focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-ring/40 [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-foreground [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-transform active:[&::-webkit-slider-thumb]:scale-125"
    />
  );
}
