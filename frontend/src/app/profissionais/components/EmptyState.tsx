import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';

type EmptyStateProps = {
  hasFilters: boolean;
  onClearFilters: () => void;
};

export default function EmptyState({
  hasFilters,
  onClearFilters,
}: EmptyStateProps) {
  return (
    <div className={ui.empty}>
      <div className={ui.emptyIcon}>
        <Icon name="people" />
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
          className={`${ui.btn} ${ui.btnSecondary}`}
          onClick={onClearFilters}
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
