'use client';

import Icon from '@/components/Icon';

export const PER_PAGE_OPTIONS = [10, 25, 50];

type PaginationProps = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  label: string;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
};

// Páginas visíveis: todas até 7; acima disso, a primeira, a última e as
// vizinhas da atual.
function visiblePages(page: number, totalPages: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, page - 1, page, page + 1]);

  return [...pages]
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((a, b) => a - b);
}

// Rodapé das tabelas (`ux-tfoot`): faixa mostrada, páginas e itens por página.
export default function Pagination({
  page,
  limit,
  total,
  totalPages,
  label,
  onPageChange,
  onLimitChange,
}: PaginationProps) {
  const first = total === 0 ? 0 : (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);
  const pages = visiblePages(page, Math.max(totalPages, 1));

  return (
    <div className="ux-tfoot">
      <span>
        Mostrando {first}–{last} de {total}
      </span>

      <nav className="ux-pages" aria-label={label}>
        <button
          type="button"
          disabled={page <= 1}
          aria-label="Página anterior"
          onClick={() => onPageChange(page - 1)}
        >
          <Icon name="chevronLeft" className="icon-sm" />
        </button>

        {pages.map((item) => (
          <button
            key={item}
            type="button"
            aria-current={item === page ? 'page' : undefined}
            aria-label={`Página ${item}`}
            onClick={() => onPageChange(item)}
          >
            {item}
          </button>
        ))}

        <button
          type="button"
          disabled={page >= totalPages}
          aria-label="Próxima página"
          onClick={() => onPageChange(page + 1)}
        >
          <Icon name="chevronRight" className="icon-sm" />
        </button>
      </nav>

      <label className="ux-perpage">
        <span>Itens por página</span>
        <select
          className="select"
          aria-label="Itens por página"
          value={limit}
          onChange={(event) => onLimitChange(Number(event.target.value))}
        >
          {PER_PAGE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
