import styles from '../proposals.module.css';

type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export default function Pagination({
  page,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className={styles.pagination} aria-label="Paginação das propostas">
      <button
        type="button"
        className={styles.paginationButton}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Anterior
      </button>

      <span className={styles.pageInfo}>
        Página <strong>{page}</strong> de <strong>{totalPages}</strong>
      </span>

      <button
        type="button"
        className={styles.paginationButton}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Próxima
      </button>
    </nav>
  );
}
