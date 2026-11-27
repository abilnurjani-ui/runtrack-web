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
    { href: '/', label: 'Track Builder', icon: Map },
    { href: '/feed', label: 'Club Feed', icon: Flame },
    { href: '/dashboard', label: 'My Log & ACWR', icon: LayoutDashboard },
    { href: '/import', label: 'Import FIT/GPX', icon: UploadCloud },
  ];

  return (
    <nav className="bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 px-4 md:px-8 h-16 flex items-center justify-between sticky top-0 z-50 text-white">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-3 group">
          <SsoLogo size="md" />
          <div className="leading-none">
            <span className="block font-black text-lg tracking-wider text-white">
              SSO RUNNERS
            </span>
            <span className="hidden sm:block text-[10px] font-bold tracking-[0.22em] uppercase text-orange-500 mt-1">
              MOVE // CONNECT // GROW
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
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold whitespace-nowrap transition-all ${
                  active
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/25'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {userEmail ? (
          <>
            <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full text-xs font-bold text-zinc-200">
              <User className="w-3.5 h-3.5 text-orange-500" />
              <span>@{userEmail.split('@')[0]}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-400 hover:text-red-400 hover:bg-zinc-900 rounded-xl transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-black uppercase tracking-wider rounded-xl shadow-sm transition"
          >
            <LogIn className="w-3.5 h-3.5 text-orange-600" />
            Masuk / Gabung
          </Link>
        )}
      </div>
    </nav>
  );
}
