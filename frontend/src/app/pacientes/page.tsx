import AuthorizedPatients from './components/AuthorizedPatients';
import styles from './pacientes.module.css';

export default function PacientesPage() {
  return (
    <main className={styles.page}>
      <section className={styles.content}>
        <header className={styles.heading}>
          <p className={styles.eyebrow}>Área profissional</p>

          <h1>Pacientes</h1>

          <p className={styles.description}>
            Acompanhe os pacientes vinculados ao seu acesso.
          </p>
        </header>

        <AuthorizedPatients />
      </section>
    </main>
  );
}
