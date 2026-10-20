'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Session from 'supertokens-web-js/recipe/session';
import Logo from '@/components/Logo';
import { initSuperTokens } from '@/lib/supertokens';
import { getCurrentProfessional } from './api/ptsApi';
import type { Professional } from './types';

type NavKey = 'patients' | 'createPts';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="h-[18px] w-[18px] shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const itemCls = (active: boolean) =>
  `flex min-h-[46px] w-full items-center gap-3 rounded-xl px-4 text-left text-[13px] transition-colors ${
    active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
  }`;

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

export function AppShell({ active, children }: { active: NavKey; children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<Professional | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    initSuperTokens();
    const controller = new AbortController();
    getCurrentProfessional(controller.signal)
      .then(setUser)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  function toggleSidebar() {
    setMobileOpen((v) => !v); // celular: abre/fecha o menu
    setCollapsed((v) => !v); // desktop: recolhe/expande
  }

  async function handleLogout() {
    try {
      await Session.signOut();
    } finally {
      router.push('/login');
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-800">
      {mobileOpen && (
        <div className="fixed inset-0 z-20 bg-slate-900/30 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      <aside
        id="sidebar"
        className={`fixed inset-y-0 left-0 z-30 flex w-[207px] flex-col border-r border-slate-200 bg-white transition-transform duration-200 motion-reduce:transition-none ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0'}`}
      >
        <div className="flex h-[72px] items-center px-5">
          <Link href="/" className="inline-flex text-slate-900">
            <Logo />
          </Link>
        </div>

        <p className="px-5 pb-3 pt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
          Área de trabalho
        </p>
        <nav aria-label="Menu principal" className="space-y-1 px-2">
          <Link href="/pacientes" className={itemCls(active === 'patients')} aria-current={active === 'patients' ? 'page' : undefined}>
            <Icon>
              <circle cx="9" cy="8" r="3" />
              <path d="M3 20v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m1 3a5 5 0 0 1 4 5v2" />
            </Icon>
            Pacientes
          </Link>
          <Link href="/pts/novo" className={itemCls(active === 'createPts')} aria-current={active === 'createPts' ? 'page' : undefined}>
            <Icon>
              <rect x="5" y="4" width="14" height="17" rx="2" />
              <path d="M9 3h6v3H9zM9 11h6m-6 4h6" />
            </Icon>
            Criar proposta de PTS
          </Link>
        </nav>

        <div className="mt-auto border-t border-slate-200 px-2 pb-4 pt-3">
          <Link href="/meu-perfil" className={itemCls(false)}>
            <Icon>
              <circle cx="12" cy="7" r="4" />
              <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
            </Icon>
            Meu perfil
          </Link>
          <button type="button" onClick={handleLogout} className={itemCls(false)}>
            <Icon>
              <path d="M9 3H4v18h5M10 12h11m-4-4 4 4-4 4" />
            </Icon>
            Sair da conta
          </button>
          <p className="px-4 pt-4 text-[10px] leading-4 text-slate-500">
            Cuidado singular.
            <br />
            Construção compartilhada.
          </p>
        </div>
      </aside>

      <div className={`transition-[padding] duration-200 motion-reduce:transition-none ${collapsed ? '' : 'lg:pl-[207px]'}`}>
        <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-slate-200 bg-white px-6">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Alternar barra lateral"
            aria-controls="sidebar"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
          >
            <Icon>
              <path d="M4 6h16M4 12h16M4 18h16" />
            </Icon>
          </button>

          <Link href="/meu-perfil" className="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-slate-50">
            <span
              aria-hidden="true"
              className="grid h-[38px] w-[38px] place-items-center rounded-lg border border-slate-200 bg-[#fafaf9] text-[12px] font-semibold text-slate-700"
            >
              {user ? initials(user.name) : ''}
            </span>
            <span className="leading-tight">
              <strong className="block text-[12px] font-semibold text-slate-900">{user?.name ?? 'Carregando...'}</strong>
              <small className="block text-[10px] text-slate-500">Profissional</small>
            </span>
            <svg className="h-4 w-4 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </Link>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}
