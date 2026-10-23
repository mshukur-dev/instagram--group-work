import { NotificationsContent } from '@/features/notifications/components/notifications-content';

// Phone: notifications are a page of their own (on desktop they slide out next to the menu)
export default function NotificationsPage() {
  return (
    <div className="mx-auto w-full max-w-150 py-4 max-md:py-0">
      <NotificationsContent />
    </div>
  );
}
