import styles from '../pacientes.module.css';

type EmptyStateProps = {
  isSearch?: boolean;
  onClearSearch?: () => void;
};

export default function EmptyState({
  isSearch = false,
  onClearSearch,
}: EmptyStateProps) {
  return (
    <div className={styles.state}>
      <div>
        <div className={styles.emptyIcon}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="6" />
            <path d="m15 15 6 6" />
          </svg>
        </div>

        <h2>Nenhum paciente encontrado</h2>

        <p>
          {isSearch
            ? 'Tente outro nome ou limpe a busca.'
            : 'Você ainda não possui pacientes autorizados para consulta.'}
        </p>

        {isSearch && onClearSearch && (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onClearSearch}
          >
            Limpar busca
          </button>
        )}
      </div>
    </div>
  );
}
