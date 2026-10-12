import styles from '../profissionais.module.css';

type EmptyStateProps = {
  hasFilters: boolean;
  onClearFilters: () => void;
};

export default function EmptyState({
  hasFilters,
  onClearFilters,
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
            <circle cx="8" cy="8" r="3" />
            <circle cx="17" cy="8" r="3" />
            <path d="M2 20v-2a6 6 0 0 1 12 0v2M14 14a5 5 0 0 1 8 4v2" />
          </svg>
        </div>

        <h2>Nenhum profissional encontrado</h2>

        <p>
          {hasFilters
            ? 'Não encontramos profissionais compatíveis com os filtros informados.'
            : 'Não existem profissionais disponíveis para consulta.'}
        </p>

        {hasFilters && (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onClearFilters}
          >
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}
