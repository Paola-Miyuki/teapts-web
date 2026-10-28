import styles from '../proposals.module.css';

export type PtsProposal = {
  id: string;
  status?: string;
  socialSituation?: string;
  patient?: {
    id: string;
    name: string;
  };
  responsible?: {
    name: string;
    specialism?: {
      name: string;
    };
  };
  team?: Array<{
    id: string;
    name: string;
    specialism?: {
      name: string;
    };
  }>;
};

const statusMap: Record<string, string> = {
  draft: 'Rascunho',
  pending: 'Aguardando aprovação',
  accepted: 'Aceita',
  rejected: 'Rejeitada',
  completed: 'Concluída',
};

export default function PtsProposalCard({
  proposal,
}: {
  proposal: PtsProposal;
}) {
  const profName =
    proposal.responsible?.name || 'Profissional não identificado';
  const profSpecialism =
    proposal.responsible?.specialism?.name || 'Especialidade não informada';
  const patientName = proposal.patient?.name || 'Paciente não informado';
  const socialSit =
    proposal.socialSituation || 'Situação social não preenchida.';
  const initial = profName.charAt(0).toUpperCase();

  const displayStatus = proposal.status
    ? statusMap[proposal.status.toLowerCase()] || proposal.status
    : 'Aguardando aprovação';

  return (
    <article
      className={styles.proposalCard}
      style={{
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className={styles.personBanner}>
        <div className={styles.professionalIdentity}>
          <div className={styles.proposalAvatar}>{initial}</div>
          <div className={styles.personText}>
            <h2>{profName}</h2>
            <p>{profSpecialism} &middot; profissional responsável</p>
          </div>
        </div>
        <div className={styles.statusBadge}>{displayStatus}</div>
      </div>

      <div className={styles.metaGrid}>
        <div className={styles.metaBlock}>
          <span className={styles.metaLabel}>Paciente</span>
          <span className={styles.metaValue}>
            <strong>{patientName}</strong>
          </span>
        </div>
        <div className={styles.metaBlock}>
          <span className={styles.metaLabel}>Equipe multidisciplinar</span>
          <span className={styles.metaValue}>
            {proposal.team && proposal.team.length > 0
              ? `${proposal.team.length} profissional(is)`
              : 'Ainda não definida'}
          </span>
        </div>
      </div>

      <div className={styles.socialSituation}>
        <h3>Situação Social</h3>
        <p
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {socialSit}
        </p>
      </div>

      <div className={styles.teamSection}>
        <h3>Equipe</h3>
        {proposal.team && proposal.team.length > 0 ? (
          <div className={styles.teamList}>
            {proposal.team.map((member) => (
              <div key={member.id} className={styles.teamMember}>
                <div className={styles.teamAvatar}>
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <strong>{member.name}</strong>
                  <div className={styles.teamSpecialism}>
                    {member.specialism?.name || 'Especialidade não informada'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.emptyTeam}>
            A equipe multidisciplinar ainda não possui outros profissionais
            definidos.
          </p>
        )}
      </div>
    </article>
  );
}
