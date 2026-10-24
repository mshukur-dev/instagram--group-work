import { cldUrl } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';

type Props = {
  src: string | null;
  alt: string;
  size: number;
  /** Story ring: colored for unseen stories, gray when all are seen */
  ring?: 'unseen' | 'seen' | 'none';
  /** Ring width: the stories tray uses the thick one, small avatars keep the thin one */
  ringWidth?: 'thin' | 'thick';
  className?: string;
};

export function UserAvatar({
  src,
  alt,
  size,
  ring = 'none',
  ringWidth = 'thin',
  className,
}: Props) {
  const thick = ringWidth === 'thick';
  const image = src ? (
    <img
      src={cldUrl(src, 'c_fill,w_150,h_150,f_auto,q_auto')}
      alt={alt}
      draggable={false}
      width={size}
      height={size}
      // max-w-none: the default max-width: 100% would squeeze it into an oval in a tight spot
      className="max-w-none shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    // Instagram's default profile picture: gray circle with a light silhouette
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-label={alt}
      className="max-w-none shrink-0 rounded-full bg-muted-foreground/40 fill-background"
      style={{ width: size, height: size }}
    >
      <circle cx="20" cy="15.5" r="7.5" />
      <path d="M5 37c1.5-8 7.5-12.5 15-12.5S33.5 29 35 37a20 20 0 0 1-30 0Z" />
    </svg>
  );

  if (ring === 'none')
    return <span className={cn('inline-flex shrink-0', className)}>{image}</span>;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-full',
        thick ? 'p-0.75' : 'p-0.5',
        ring === 'unseen' ? 'bg-story-ring' : 'bg-story-seen',
        className,
      )}
    >
      <span className={cn('shrink-0 rounded-full bg-background', thick ? 'p-0.75' : 'p-0.5')}>
        {image}
      </span>
    </span>
  );
}
