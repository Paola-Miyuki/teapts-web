import type { Professional } from '../types';
import Icon from '@/components/Icon';
import styles from '../novo.module.css';
import { fieldCls, helpCls, labelCls } from '../styles';

interface Props {
  professionals: Professional[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}

export function ProfessionalTeamSelect({
  professionals,
  selectedIds,
  onToggle,
  disabled,
}: Props) {
  const count = selectedIds.length;

  const summary =
    count === 0
      ? 'Selecione os profissionais'
      : `${count} ${
          count === 1
            ? 'profissional selecionado'
            : 'profissionais selecionados'
        }`;

  return (
    <div className={fieldCls}>
      <span id="team-label" className={labelCls}>
        Equipe multidisciplinar{' '}
        <span className={styles.optional}>(opcional)</span>
      </span>

      <details className={styles.team} aria-labelledby="team-label">
        <summary className={styles.teamSummary}>
          <span>{summary}</span>

          <Icon name="chevronDown" className={styles.teamChevron} />
        </summary>

        <div className={styles.teamList}>
          {professionals.length === 0 && (
            <p className={styles.teamEmpty}>Nenhum profissional disponível.</p>
          )}

          {professionals.map((p) => (
            <label key={p.id} className={styles.teamOption}>
              <input
                type="checkbox"
                name="team"
                value={p.id}
                checked={selectedIds.includes(p.id)}
                disabled={disabled}
                onChange={() => onToggle(p.id)}
              />

              <span>
                {p.name}
                <small>{p.specialism.name}</small>
              </span>
            </label>
          ))}
        </div>
      </details>

      <p className={helpCls}>
        O responsável poderá adicionar ou remover profissionais depois.
      </p>
    </div>
  );
}
