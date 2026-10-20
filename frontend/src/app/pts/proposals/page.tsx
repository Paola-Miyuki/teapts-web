import { Suspense } from 'react';
import Link from 'next/link';

import Logo from '@/components/Logo';

import CurrentUserHeader from './components/CurrentUserHeader';
import LoadingState from './components/LoadingState';
import LogoutButton from './components/LogoutButton';
import PtsProposalList from './components/PtsProposalList';

import styles from './proposals.module.css';

export default function PtsProposalsPage() {
  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <div>
          <Link
            href="/home"
            className={styles.brand}
          >
            <Logo caption="Programa Terapêutico Singular" />
          </Link>

          <p className={styles.navCaption}>
            Meu cuidado
          </p>

          <nav
            className={styles.nav}
            aria-label="Menu principal"
          >
            <Link
              href="/home"
              className={styles.navLink}
            >
              <svg
                className={styles.icon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m3 10 9-7 9 7v10H3Z" />
                <path d="M9 20v-7h6v7" />
              </svg>

              <span>Meu cuidado</span>
            </Link>

            <Link
              href="/pts/proposals"
              className={`${styles.navLink} ${styles.navActive}`}
            >
              <svg
                className={styles.icon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect
                  x="5"
                  y="4"
                  width="14"
                  height="17"
                  rx="2"
                />

                <path d="M9 3h6v3H9zM9 11h6m-6 4h6" />
              </svg>

              <span>Propostas de PTS</span>
            </Link>

            <div
              className={styles.navLink}
              aria-disabled="true"
              style={{
                cursor: 'default',
              }}
            >
              <svg
                className={styles.icon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle
                  cx="9"
                  cy="8"
                  r="3"
                />

                <path d="M3 20v-3a6 6 0 0 1 12 0v3" />
                <path d="M16 4a3 3 0 0 1 0 6" />
                <path d="M17 13a5 5 0 0 1 4 5v2" />
              </svg>

              <span>Meu PTS</span>
            </div>

            <div
              className={styles.navLink}
              aria-disabled="true"
              style={{
                cursor: 'default',
              }}
            >
              <svg
                className={styles.icon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 7V5h6l2 3h10v12H3Z" />
              </svg>

              <span>Prontuário</span>
            </div>

            <div
              className={styles.navLink}
              aria-disabled="true"
              style={{
                cursor: 'default',
              }}
            >
              <svg
                className={styles.icon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 11a9 9 0 1 1 2 7" />
                <path d="M3 4v7h7" />
                <path d="M12 7v5l4 2" />
              </svg>

              <span>Histórico</span>
            </div>
          </nav>
        </div>

        <div className={styles.sideBottom}>
          <div className={styles.sideDivider} />

          <div
            className={styles.navLink}
            aria-disabled="true"
            style={{
              cursor: 'default',
            }}
          >
            <svg
              className={styles.icon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="7"
                r="4"
              />

              <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
            </svg>

            <span>Meu perfil</span>
          </div>

          <LogoutButton />

          <p className={styles.sideNote}>
            Cuidado singular.
            <br />
            Construção compartilhada.
          </p>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.appHeader}>
          <button
            type="button"
            className={styles.menuButton}
            aria-label="Abrir menu"
          >
            <svg
              className={styles.icon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <CurrentUserHeader />
        </header>

        <main className={styles.content}>
          <nav
            className={styles.breadcrumb}
            aria-label="Caminho da página"
          >
            <Link href="/home">
              Início
            </Link>

            <span aria-hidden="true">
              /
            </span>

            <span>
              Propostas de PTS
            </span>
          </nav>

          <section className={styles.section}>
            <div className={styles.heading}>
              <div>
                <p className={styles.eyebrow}>
                  Seu cuidado, sua escolha
                </p>

                <h1>
                  Propostas de PTS
                </h1>

                <p className={styles.description}>
                  Conheça a equipe que vai planejar
                  seu Programa Terapêutico Singular.
                </p>
              </div>
            </div>

            <div className={styles.notice}>
              <strong>
                Uma equipe por vez.
              </strong>{' '}
              Ao aceitar uma proposta, as outras
              propostas pendentes serão
              automaticamente rejeitadas.
            </div>

            <Suspense
              fallback={<LoadingState />}
            >
              <PtsProposalList />
            </Suspense>
          </section>

          <footer className={styles.footer}>
            <span>
              TEA-PTS · Programa Terapêutico Singular
            </span>

            <span>
              Propostas disponíveis no sistema
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}