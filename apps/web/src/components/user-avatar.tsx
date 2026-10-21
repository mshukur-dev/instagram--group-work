import { cldUrl } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';

type Props = {
  src: string | null;
  alt: string;
  size: number;
  /** Story ring: colored for unseen stories, gray when all are seen */
  ring?: 'unseen' | 'seen' | 'none';
  className?: string;
};

export function UserAvatar({ src, alt, size, ring = 'none', className }: Props) {
  const image = src ? (
    <img
      src={cldUrl(src, 'c_fill,w_150,h_150,f_auto,q_auto')}
      alt={alt}
      width={size}
      height={size}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    // Instagram's default profile picture: gray circle with a light silhouette
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-label={alt}
      className="rounded-full bg-muted-foreground/40 fill-background"
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
        'inline-flex shrink-0 rounded-full p-0.5',
        ring === 'unseen' ? 'bg-story-ring' : 'bg-border',
        className,
      )}
    >
      <span className="rounded-full bg-background p-0.5">{image}</span>
    </span>
  );
}
