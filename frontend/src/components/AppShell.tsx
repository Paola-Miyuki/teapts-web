'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';

import Logo from '@/components/Logo';
import LogoutButton from '@/components/LogoutButton';
import type { NavItem } from '@/lib/account';
import styles from './AppShell.module.css';
import Icon from './Icon';

type AppShellProps = {
  userName: string;
  roleLabel: string;
  navCaption: string;
  navItems: NavItem[];
  breadcrumb?: string;
  children: ReactNode;
};

// Mesmo ponto de quebra do layout: abaixo dele a barra lateral vira gaveta.
const MOBILE_QUERY = '(max-width: 920px)';

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function AppShell({
  userName,
  roleLabel,
  navCaption,
  navItems,
  breadcrumb,
  children,
}: AppShellProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const media = window.matchMedia(MOBILE_QUERY);
    const sync = () => setIsMobile(media.matches);

    sync();
    media.addEventListener('change', sync);

    return () => media.removeEventListener('change', sync);
  }, []);

  const expanded = isMobile ? open : !collapsed;

  const toggleLabel = isMobile
    ? expanded
      ? 'Fechar navegação'
      : 'Abrir navegação'
    : expanded
      ? 'Recolher barra lateral'
      : 'Expandir barra lateral';

  function handleToggle() {
    if (isMobile) {
      setOpen((current) => !current);
    } else {
      setCollapsed((current) => !current);
    }
  }

  const appClassName = [
    styles.app,
    !isMobile && collapsed ? styles.collapsed : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={appClassName}>
      <aside
        id="sidebar"
        className={`${styles.sidebar} ${isMobile && open ? styles.open : ''}`}
      >
        <Link
          href="/home"
          className={styles.brand}
          aria-label="TEA-PTS, início"
        >
          <Logo caption="Programa Terapêutico Singular" />
        </Link>

        {!isMobile && (
          <button
            type="button"
            className={styles.edgeToggle}
            aria-label={toggleLabel}
            title={toggleLabel}
            aria-controls="sidebar"
            aria-expanded={expanded}
            onClick={handleToggle}
          >
            <Icon
              name={expanded ? 'chevronLeft' : 'chevronRight'}
              className={styles.edgeIcon}
            />
          </button>
        )}

        <button
          type="button"
          className={`${styles.iconButton} ${styles.menuClose}`}
          aria-label="Fechar navegação"
          onClick={() => setOpen(false)}
        >
          <Icon name="close" className={styles.icon} />
        </button>

        <p className={styles.navCaption}>{navCaption}</p>

        <nav className={styles.nav} aria-label="Menu principal">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={styles.navLink}
              aria-current={item.current ? 'page' : undefined}
              title={item.label}
            >
              <Icon name={item.icon} className={styles.icon} />
              <span className={styles.navLabel}>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className={styles.sideBottom}>
          <LogoutButton className={styles.navLink}>
            <Icon name="logout" className={styles.icon} />
            <span className={styles.navLabel}>Sair da conta</span>
          </LogoutButton>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.appHeader}>
          {isMobile && (
            <button
              type="button"
              className={styles.iconButton}
              aria-label={toggleLabel}
              title={toggleLabel}
              aria-controls="sidebar"
              aria-expanded={expanded}
              onClick={handleToggle}
            >
              <Icon name="menu" className={styles.icon} />
            </button>
          )}

          <div className={styles.headerProfile}>
            <span className={styles.avatar} aria-hidden="true">
              {getInitials(userName)}
            </span>

            <span className={styles.profileInfo}>
              <strong>{userName}</strong>
              <small>{roleLabel}</small>
            </span>
          </div>
        </header>

        <main className={styles.content}>
          {breadcrumb && (
            <nav className={styles.breadcrumb} aria-label="Caminho da página">
              <Link href="/home">Início</Link>
              <span aria-hidden="true">/</span>
              <span>{breadcrumb}</span>
            </nav>
          )}

          <section>{children}</section>
        </main>
      </div>
    </div>
  );
}
