import { AdminShell } from '@/features/admin/components/admin-shell';

// No server metadata: the tab title is set by AdminShell only for administrators,
// so for everyone else /admin looks exactly like any missing page (ADMIN-1)
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
