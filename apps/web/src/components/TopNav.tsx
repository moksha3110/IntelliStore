'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearStoredSession, getStoredSession, type StoredUser } from '../lib/auth-storage';

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    setUser(getStoredSession()?.user ?? null);
  }, [pathname]);

  function handleLogout() {
    clearStoredSession();
    setUser(null);
    router.push('/login');
  }

  return (
    <nav className="border-b border-brand-900/60 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold text-white">
          IntelliStore
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/" className="text-slate-300 hover:text-white">
            Home
          </Link>
          <Link href="/dashboard" className="text-slate-300 hover:text-white">
            Dashboard
          </Link>
          {user ? (
            <>
              <span className="text-brand-300">{user.displayName}</span>
              <button
                onClick={handleLogout}
                className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-500"
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-500"
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
