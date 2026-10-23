import { Clapperboard, Compass, Heart, House, Search, Send, SquarePlus } from 'lucide-react';

// Main navigation; labels are keys in the "nav" translations
export const navItems = [
  { key: 'home', href: '/', icon: House },
  { key: 'search', href: '/explore/search', icon: Search },
  { key: 'explore', href: '/explore', icon: Compass },
  { key: 'reels', href: '/reels', icon: Clapperboard },
  { key: 'messages', href: '/direct/inbox', icon: Send },
  { key: 'notifications', href: '/notifications', icon: Heart },
  { key: 'create', href: '/create', icon: SquarePlus },
] as const;

export function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  // /explore/search belongs to Search, not Explore
  if (href === '/explore' && pathname.startsWith('/explore/search')) return false;
  return pathname.startsWith(href);
}
