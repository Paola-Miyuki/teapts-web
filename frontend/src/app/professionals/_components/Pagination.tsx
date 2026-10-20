import ui from '@/components/ui.module.css';
import styles from '../professionals.module.css';

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
    <nav className={styles.pagination} aria-label="Paginação de profissionais">
      <button
        type="button"
        className={`${ui.btn} ${ui.btnSecondary}`}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Anterior
      </button>

      <span>
        Página {page} de {totalPages}
      </span>

      <button
        type="button"
        className={`${ui.btn} ${ui.btnSecondary}`}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Próxima
      </button>
    </nav>
  );
}
