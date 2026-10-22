import { DirectLayout } from '@/features/direct/components/direct-layout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DirectLayout>{children}</DirectLayout>;
}
