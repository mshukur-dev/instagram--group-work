import { Suspense } from 'react';
import { AdminUsers } from '@/features/admin/components/admin-users';

export default function AdminUsersPage() {
  // useSearchParams (?filter=banned) needs a Suspense boundary
  return (
    <Suspense>
      <AdminUsers />
    </Suspense>
  );
}
