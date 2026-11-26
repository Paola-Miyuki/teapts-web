import ui from '@/components/ui.module.css';
import type { PtsProfessional } from '@/lib/pts';

import styles from '../pts.module.css';

type PtsTeamListProps = {
  responsible: PtsProfessional;
  team: PtsProfessional[];
  // RFEM003 – só o responsável remove; o botão nunca aparece no responsável.
  onRemove?: (member: PtsProfessional) => void;
  onTransferResponsibility?: () => void;
};

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function Member({
  professional,
  isResponsible = false,
  onRemove,
}: {
  professional: PtsProfessional;
  isResponsible?: boolean;
  onRemove?: (member: PtsProfessional) => void;
}) {
  const name = professional.name || 'Profissional não identificado';

  return (
    <li className={styles.teamMember}>
      <span className={styles.teamAvatar} aria-hidden="true">
        {initial(professional.name)}
      </span>

      <div>
        <strong>{name}</strong>
        <small>
          {professional.specialism?.name || 'Especialidade não informada'}
          {isResponsible && ' · responsável'}
        </small>
      </div>

      {onRemove && !isResponsible && (
        <button
          type="button"
          className={`${ui.btn} ${ui.btnSecondary} ${styles.memberAction}`}
          aria-label={`Remover ${name} da equipe`}
          onClick={() => onRemove(professional)}
        >
          Remover
        </button>
      )}
    </li>
  );
}

// Equipe multidisciplinar do PTS ativo: o responsável primeiro e depois os
// demais membros. As ações sobre a equipe (RFEM003) entram aqui.
export default function PtsTeamList({
  responsible,
  team,
  onRemove,
  onTransferResponsibility,
}: PtsTeamListProps) {
  const members = team.filter((member) => member.id !== responsible.id);
  const total = members.length + 1;

  return (
    <details className={styles.accordion} open>
      <summary>
        Equipe multidisciplinar
        <span className={styles.count}>
          {total} {total === 1 ? 'profissional' : 'profissionais'}
        </span>
      </summary>

      {onTransferResponsibility && (
        <div className={styles.teamActions}>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnSecondary}`}
            onClick={onTransferResponsibility}
          >
            Transferir responsabilidade
          </button>
        </div>
      )}

      <ul className={styles.teamList} aria-label="Equipe multidisciplinar">
        <Member professional={responsible} isResponsible />

        {members.map((member) => (
          <Member key={member.id} professional={member} onRemove={onRemove} />
        ))}
      </ul>

      {members.length === 0 && (
        <p className={styles.muted}>
          Ainda não há outros profissionais na equipe deste plano.
        </p>
      )}
    </details>
  );
}
