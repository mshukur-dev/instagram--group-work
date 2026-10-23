import type { PostLocation } from '@instagram/shared';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/** The place under the author's name in a post header; opens the place's page */
export function LocationLink({
  location,
  className,
}: {
  location: PostLocation;
  className?: string;
}) {
  return (
    <Link
      href={`/explore/locations/${location.id}`}
      className={cn('block truncate text-xs leading-tight hover:underline', className)}
    >
      {location.name}
    </Link>
  );
}
