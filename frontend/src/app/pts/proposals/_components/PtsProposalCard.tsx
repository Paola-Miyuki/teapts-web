import styles from '../proposals.module.css';

export type ProposalSpecialism = {
  id?: string;
  name?: string;
};

export type ProposalProfessional = {
  id?: string;
  name?: string;
  specialism?: ProposalSpecialism | null;
};

export type ProposalPatient = {
  id?: string;
  name?: string;
};

export type ProposalTeamMember = {
  id?: string;
  name?: string;
  specialism?: ProposalSpecialism | null;
};

export type PtsProposal = {
  id: string;
  status?: string;
  socialSituation?: string;
  createdAt?: string;
  patient?: ProposalPatient | string;
  responsible?: ProposalProfessional;
  team?: ProposalTeamMember[];
  // Nomes alternativos que o card e a lista aceitam, conforme o formato que a
  // API devolver.
  patientId?: string;
  patientName?: string;
  professional?: ProposalProfessional;
  responsibleProfessional?: ProposalProfessional;
  professionalId?: string;
  responsibleId?: string;
  responsibleProfessionalId?: string;
  creatorId?: string;
  createdById?: string;
  professionalName?: string;
  responsibleName?: string;
  specialismName?: string;
  speciality?: string;
  teamProfessionals?: ProposalTeamMember[];
  [key: string]: unknown;
};

type PtsProposalCardProps = {
  proposal: PtsProposal;
};

function getInitial(name?: string | null) {
  if (!name || typeof name !== 'string') {
    return '?';
  }

  const trimmedName = name.trim();

  if (!trimmedName) {
    return '?';
  }

  return trimmedName.charAt(0).toUpperCase();
}

export default function PtsProposalCard({ proposal }: PtsProposalCardProps) {
  const responsibleName =
    proposal?.responsible?.name ??
    proposal?.professional?.name ??
    proposal?.responsibleProfessional?.name ??
    proposal?.professionalName ??
    proposal?.responsibleName ??
    'Profissional não identificado';

  const specialismName =
    proposal?.responsible?.specialism?.name ??
    proposal?.professional?.specialism?.name ??
    proposal?.responsibleProfessional?.specialism?.name ??
    proposal?.specialismName ??
    proposal?.speciality ??
    'Especialidade não informada';

  const patientName =
    typeof proposal?.patient === 'object' && proposal?.patient?.name
      ? proposal.patient.name
      : typeof proposal?.patient === 'string'
        ? proposal.patient
        : (proposal?.patientName ?? 'Paciente não informado');

  const teamList = Array.isArray(proposal?.team)
    ? proposal.team
    : Array.isArray(proposal?.teamProfessionals)
      ? proposal.teamProfessionals
      : [];

  return (
    <article className={styles.proposalCard}>
      <div className={styles.personBanner}>
        <div className={styles.professionalIdentity}>
          <span className={styles.proposalAvatar} aria-hidden="true">
            {getInitial(responsibleName)}
          </span>

          <div className={styles.personText}>
            <h2>{responsibleName}</h2>

            <p>
              {specialismName}
              {' · '}
              profissional responsável
            </p>
          </div>
        </div>

        <span className={styles.statusBadge}>
          {proposal?.status === 'draft' || !proposal?.status
            ? 'Aguardando sua decisão'
            : proposal.status}
        </span>
      </div>

      <div className={styles.metaGrid}>
        <div className={styles.metaBlock}>
          <span className={styles.metaLabel}>Paciente</span>
          <strong className={styles.metaValue}>{patientName}</strong>
        </div>

        <div className={styles.metaBlock}>
          <span className={styles.metaLabel}>Equipe multidisciplinar</span>

          {teamList.length > 0 ? (
            <strong className={styles.metaValue}>
              {teamList.length === 1
                ? '1 profissional'
                : `${teamList.length} profissionais`}
            </strong>
          ) : (
            <strong className={styles.metaValue}>Ainda não definida</strong>
          )}
        </div>
      </div>

      <div className={styles.socialSituation}>
        <h3>Situação social</h3>

        <p>
          {proposal?.socialSituation?.trim() ||
            'Situação social não informada.'}
        </p>
      </div>

      <div className={styles.teamSection}>
        <h3>Equipe</h3>

        {teamList.length === 0 ? (
          <p className={styles.emptyTeam}>
            A equipe multidisciplinar ainda não possui outros profissionais
            definidos.
          </p>
        ) : (
          <div className={styles.teamList}>
            {teamList.map((member) => (
              <div
                key={member?.id ?? member?.name}
                className={styles.teamMember}
              >
                <span className={styles.teamAvatar} aria-hidden="true">
                  {getInitial(member?.name)}
                </span>

                <div>
                  <strong>{member?.name ?? 'Profissional'}</strong>

                  {member?.specialism?.name ? (
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
