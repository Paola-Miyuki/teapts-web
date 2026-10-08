import styles from '../pacientes.module.css';

export default function EmptyState() {
  return (
    <div className={styles.state}>
      <div>
        <h2>Nenhum paciente encontrado</h2>

        <p>Você ainda não possui pacientes autorizados para consulta.</p>
      </div>
    </div>
  );
}
