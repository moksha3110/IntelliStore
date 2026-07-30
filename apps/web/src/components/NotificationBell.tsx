'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationDto,
} from '../lib/api';
import { formatRelativeTime } from '../lib/format';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unread, setUnread] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const { notifications: list, unreadCount } = await getNotifications();
      setNotifications(list);
      setUnread(unreadCount);
    } catch {
      // Not logged in / gateway down — keep the bell quiet rather than noisy.
    }
  }, []);

  // Poll so notifications from background events (uploads, downloads) appear
  // without a manual refresh.
  useEffect(() => {
    void load();
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
  }, [load]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function handleOpen() {
    setOpen((v) => !v);
    if (!open) await load();
  }

  async function handleMarkAll() {
    await markAllNotificationsRead();
    await load();
  }

  async function handleClickNotification(n: NotificationDto) {
    if (!n.isRead) {
      await markNotificationRead(n.id);
      await load();
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative rounded-md p-2 text-slate-300 hover:bg-brand-900/50 hover:text-white"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-brand-800/60 bg-slate-900 shadow-xl">
          <div className="flex items-center justify-between border-b border-brand-900/60 px-4 py-2">
            <span className="text-sm font-medium text-slate-100">Notifications</span>
            {unread > 0 && (
              <button onClick={handleMarkAll} className="text-xs text-brand-300 hover:text-brand-200">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className={`block w-full border-b border-brand-900/40 px-4 py-3 text-left text-sm hover:bg-brand-950/40 ${
                    n.isRead ? 'text-slate-400' : 'text-slate-100'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                    <div className={n.isRead ? 'pl-4' : ''}>
                      <p>{n.message}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{formatRelativeTime(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
