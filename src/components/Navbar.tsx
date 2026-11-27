'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import SsoLogo from '@/components/SsoLogo';
import { Flame, LayoutDashboard, LogIn, LogOut, Map, UploadCloud, User } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navItems = [
    { href: '/', label: 'Buat Track Lari', icon: Map },
    { href: '/feed', label: 'Feed Komunitas', icon: Flame },
    { href: '/dashboard', label: 'Log Pribadi & ACWR', icon: LayoutDashboard },
    { href: '/import', label: 'Import FIT/GPX', icon: UploadCloud },
  ];

  return (
    <nav className="bg-white border-b border-zinc-200 px-4 md:px-6 h-16 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <SsoLogo size="md" />
          <div className="leading-tight">
            <span className="block font-black text-base md:text-lg tracking-tight text-zinc-950">
              SSO RUNNERS
            </span>
            <span className="hidden sm:block text-[10px] font-bold tracking-widest uppercase text-zinc-500">
              Move // Connect // Grow
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs md:text-sm font-bold whitespace-nowrap transition ${
                  active
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-orange-500' : ''}`} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {userEmail ? (
          <>
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 rounded-full text-xs font-bold text-zinc-800">
              <User className="w-3.5 h-3.5 text-orange-600" />
              <span>@{userEmail.split('@')[0]}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-zinc-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-1.5 px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold rounded-lg shadow-sm transition"
          >
            <LogIn className="w-3.5 h-3.5 text-orange-500" />
            Masuk / Gabung
          </Link>
        )}
      </div>
    </nav>
  );
}
