import type { PtsProfessional } from '@/lib/pts';

import styles from '../pts.module.css';

type PtsTeamListProps = {
  responsible: PtsProfessional;
  team: PtsProfessional[];
};

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function Member({
  professional,
  isResponsible = false,
}: {
  professional: PtsProfessional;
  isResponsible?: boolean;
}) {
  return (
    <li className={styles.teamMember}>
      <span className={styles.teamAvatar} aria-hidden="true">
        {initial(professional.name)}
      </span>

      <div>
        <strong>{professional.name || 'Profissional não identificado'}</strong>
        <small>
          {professional.specialism?.name || 'Especialidade não informada'}
          {isResponsible && ' · responsável'}
        </small>
      </div>
    </li>
  );
}

// Equipe multidisciplinar do PTS ativo: o responsável primeiro e depois os
// demais membros. As ações sobre a equipe (RFEM003) entram aqui.
export default function PtsTeamList({ responsible, team }: PtsTeamListProps) {
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

      <ul className={styles.teamList} aria-label="Equipe multidisciplinar">
        <Member professional={responsible} isResponsible />

        {members.map((member) => (
          <Member key={member.id} professional={member} />
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
