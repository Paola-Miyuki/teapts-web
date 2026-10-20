import styles from '../proposals.module.css';

export type ProposalSpecialism = {
  id: string;
  name: string;
};

export type ProposalProfessional = {
  id: string;
  name: string;
  specialism: ProposalSpecialism;
};

export type ProposalPatient = {
  id: string;
  name: string;
};

export type ProposalTeamMember = {
  id: string;
  name: string;
  specialism?: ProposalSpecialism | null;
};

export type PtsProposal = {
  id: string;
  status: string;
  socialSituation: string;
  createdAt: string;
  patient: ProposalPatient;
  responsible: ProposalProfessional;
  team: ProposalTeamMember[];
};

type PtsProposalCardProps = {
  proposal: PtsProposal;
};

function getInitial(name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return '?';
  }

  return trimmedName.charAt(0).toUpperCase();
}

export default function PtsProposalCard({ proposal }: PtsProposalCardProps) {
  return (
    <article className={styles.proposalCard}>
      <div className={styles.personBanner}>
        <div className={styles.professionalIdentity}>
          <span className={styles.proposalAvatar} aria-hidden="true">
            {getInitial(proposal.responsible.name)}
          </span>

          <div className={styles.personText}>
            <h2>{proposal.responsible.name}</h2>

            <p>
              {proposal.responsible.specialism.name}
              {' · '}
              profissional responsável
            </p>
          </div>
        </div>

        <span className={styles.statusBadge}>Aguardando sua decisão</span>
      </div>

      <div className={styles.metaGrid}>
        <div className={styles.metaBlock}>
          <span className={styles.metaLabel}>Paciente</span>
          <strong className={styles.metaValue}>{proposal.patient.name}</strong>
        </div>

        <div className={styles.metaBlock}>
          <span className={styles.metaLabel}>Equipe multidisciplinar</span>

          {proposal.team.length > 0 ? (
            <strong className={styles.metaValue}>
              {proposal.team.length === 1
                ? '1 profissional'
                : `${proposal.team.length} profissionais`}
            </strong>
          ) : (
            <strong className={styles.metaValue}>Ainda não definida</strong>
          )}
        </div>
      </div>

      <div className={styles.socialSituation}>
        <h3>Situação social</h3>

        <p>
          {proposal.socialSituation?.trim() || 'Situação social não informada.'}
        </p>
      </div>

      <div className={styles.teamSection}>
        <h3>Equipe</h3>

        {proposal.team.length === 0 ? (
          <p className={styles.emptyTeam}>
            A equipe multidisciplinar ainda não possui outros profissionais
            definidos.
          </p>
        ) : (
          <div className={styles.teamList}>
            {proposal.team.map((member) => (
              <div key={member.id} className={styles.teamMember}>
                <span className={styles.teamAvatar} aria-hidden="true">
                  {getInitial(member.name)}
                </span>

                <div>
                  <strong>{member.name}</strong>

                  {member.specialism?.name ? (
                    <span className={styles.teamSpecialism}>
                      {member.specialism.name}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
