'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';

import Logo from '@/components/Logo';
import NotificationBell from '@/components/NotificationBell';
import LogoutButton from '@/components/LogoutButton';
import type { NavItem } from '@/lib/account';
import styles from './AppShell.module.css';
import Icon from './Icon';

/** Nível do caminho da página; o último não leva link. */
export type Crumb = { label: string; href?: string };

type AppShellProps = {
  userName: string;
  roleLabel: string;
  navItems: NavItem[];
  currentHref: string;
  showNotifications?: boolean;
  breadcrumb?: string | Crumb[];
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
  navItems,
  currentHref,
  showNotifications = false,
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
  const crumbs: Crumb[] =
    typeof breadcrumb === 'string'
      ? [{ label: breadcrumb }]
      : (breadcrumb ?? []);

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

        <nav className={styles.nav} aria-label="Menu principal">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} shell-navLink`}
              aria-current={item.current ? 'page' : undefined}
              title={item.label}
            >
              <Icon name={item.icon} className={styles.icon} />
              <span className={styles.navLabel}>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className={styles.sideBottom}>
          <Link
            href="/profile"
            className={`${styles.navLink} shell-navLink`}
            aria-current={
              currentHref.startsWith('/profile') ? 'page' : undefined
            }
            title="Meu perfil"
          >
            <Icon name="profile" className={styles.icon} />
            <span className={styles.navLabel}>Meu perfil</span>
          </Link>

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

          <div className="ux-header-end">
            {showNotifications && (
              <NotificationBell current={currentHref === '/notifications'} />
            )}
            <Link
              href="/profile"
              className={styles.headerProfile}
              aria-current={
                currentHref.startsWith('/profile') ? 'page' : undefined
              }
              aria-label={`Meu perfil: ${userName}, ${roleLabel}`}
              title="Meu perfil"
            >
              <span className={styles.avatar} aria-hidden="true">
                {getInitials(userName)}
              </span>

              <span className={styles.profileInfo}>
                <strong>{userName}</strong>
                <small>{roleLabel}</small>
              </span>
            </Link>
          </div>
        </header>

        <main className={`${styles.content} shell-content`}>
          {crumbs.length > 0 && (
            <nav
              className={`${styles.breadcrumb} shell-breadcrumb`}
              aria-label="Caminho da página"
            >
              <Link href="/home">Início</Link>
              {crumbs.map((crumb, index) => (
                <span key={crumb.label} className="crumb">
                  <span aria-hidden="true">/</span>
                  {crumb.href && index < crumbs.length - 1 ? (
                    <Link href={crumb.href}>{crumb.label}</Link>
                  ) : (
                    <span>{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}

          <section>{children}</section>
        </main>
      </div>
    </div>
  );
}
