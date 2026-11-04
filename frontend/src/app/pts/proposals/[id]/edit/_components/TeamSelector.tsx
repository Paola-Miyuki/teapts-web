import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';

import styles from '../edit.module.css';

import type { Professional } from '../types';

type TeamSelectorProps = {
  professionals: Professional[];
  selectedIds: string[];
  disabled?: boolean;
  onToggle: (professionalId: string) => void;
};

export default function TeamSelector({
  professionals,
  selectedIds,
  disabled = false,
  onToggle,
}: TeamSelectorProps) {
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
    <div className={ui.field}>
      <span id="edit-team-label" className={ui.label}>
        Equipe multidisciplinar{' '}
        <span className={styles.optional}>(opcional)</span>
      </span>

      <details className={styles.team} aria-labelledby="edit-team-label">
        <summary className={styles.teamSummary}>
          <span>{summary}</span>

          <Icon name="chevronDown" className={styles.teamChevron} />
        </summary>

        <div className={styles.teamList}>
          {professionals.length === 0 ? (
            <p className={styles.teamEmpty}>Nenhum profissional disponível.</p>
          ) : null}

          {professionals.map((professional) => (
            <label key={professional.id} className={styles.teamOption}>
              <input
                type="checkbox"
                name="team"
                value={professional.id}
                checked={selectedIds.includes(professional.id)}
                disabled={disabled}
                aria-label={`${professional.name} · ${professional.specialism.name}`}
                onChange={() => onToggle(professional.id)}
              />

              <span>
                <strong>{professional.name}</strong>

                <small>{professional.specialism.name}</small>
              </span>
            </label>
          ))}
        </div>
      </details>

      <p className={ui.hint}>
        O profissional responsável não aparece nesta lista.
      </p>
    </div>
  );
}
