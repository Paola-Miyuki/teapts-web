import Link from 'next/link';

import Logo from '@/components/Logo';
import AuthorizedPatients from './components/AuthorizedPatients';
import styles from './pacientes.module.css';

export default function PacientesPage() {
  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <div>
          <Link href="/" className={styles.brand}>
            <Logo caption="Programa Terapêutico Singular" />
          </Link>

          <p className={styles.navCaption}>Área de trabalho</p>

          <nav className={styles.nav} aria-label="Menu principal">
            <Link
              href="/pacientes"
              className={`${styles.navLink} ${styles.navActive}`}
            >
              <svg
                className={styles.icon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <circle cx="9" cy="8" r="3" />
                <path d="M3 20v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m1 3a5 5 0 0 1 4 5v2" />
              </svg>

              <span>Pacientes</span>
            </Link>

            <Link href="/criar-pts" className={styles.navLink}>
              <svg
                className={styles.icon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <rect x="5" y="4" width="14" height="17" rx="2" />
                <path d="M9 3h6v3H9zM9 11h6m-6 4h6" />
              </svg>

              <span>Criar proposta de PTS</span>
            </Link>
          </nav>
        </div>

        <div className={styles.sideBottom}>
          <Link href="/meu-perfil" className={styles.navLink}>
            <svg
              className={styles.icon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <circle cx="12" cy="7" r="4" />
              <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
            </svg>

            <span>Meu perfil</span>
          </Link>

          <button
            type="button"
            className={styles.navLinkButton}
            aria-label="Sair da conta"
          >
            <svg
              className={styles.icon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <path d="M9 3H4v18h5M10 12h11m-4-4 4 4-4 4" />
            </svg>

            <span>Sair da conta</span>
          </button>

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
              aria-hidden="true"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <button type="button" className={styles.profileButton}>
            <span className={styles.profileAvatar}>P</span>

            <span className={styles.profileInfo}>
              <strong>Profissional</strong>
              <small>Conta autenticada</small>
            </span>

            <svg
              className={styles.icon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </header>

        <main className={styles.content}>
          <nav className={styles.breadcrumb} aria-label="Caminho da página">
            <Link href="/">Início</Link>
            <span aria-hidden="true">/</span>
            <span>Pacientes</span>
          </nav>

          <section className={styles.section}>
            <div className={styles.heading}>
              <div>
                <p className={styles.eyebrow}>Área profissional</p>

                <h1>Pacientes</h1>

                <p className={styles.description}>
                  Acompanhe os pacientes vinculados a você e acesse seus planos
                  de cuidado.
                </p>
              </div>

              <Link href="/criar-pts" className={styles.primaryButton}>
                <svg
                  className={styles.icon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <path d="M12 4v16M4 12h16" />
                </svg>
                Criar proposta de PTS
              </Link>
            </div>

            <AuthorizedPatients />
          </section>

          <footer className={styles.footer}>
            <span>TEA-PTS · Programa Terapêutico Singular</span>
            <span>Pacientes vinculados ao seu acesso</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
