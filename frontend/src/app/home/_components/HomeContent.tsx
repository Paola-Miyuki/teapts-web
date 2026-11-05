import Link from 'next/link';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import type { Account, ProfileKind } from '@/lib/account';
import { can } from '@/lib/permissions';
import styles from '../home.module.css';

type HomeContentProps = {
  account: Account;
  kind: ProfileKind;
  name: string;
};

const EYEBROWS: Record<ProfileKind, string> = {
  admin: 'Área administrativa',
  professional: 'Área profissional',
  patient: 'Área do paciente',
  waiting: 'Área do paciente',
};

export default function HomeContent({ account, kind, name }: HomeContentProps) {
  const firstName = name.trim().split(/\s+/)[0] ?? '';
  const patientCare = can(account, 'viewOwnCare');
  const waitingHome = can(account, 'viewWaitingHome');
  const patientArea = patientCare || waitingHome;

  return (
    <>
      <div className={ui.heading}>
        <p className={ui.eyebrow}>{EYEBROWS[kind]}</p>

        <h1>{firstName ? `Boas-vindas, ${firstName}.` : 'Boas-vindas.'}</h1>

        <p>
          {patientArea
            ? 'Um espaço para acompanhar seu cuidado e as pessoas que fazem parte dele.'
            : 'Acompanhe seus pacientes e construa planos de cuidado com a equipe multidisciplinar.'}
        </p>
      </div>

      {waitingHome ? (
        <div className={ui.empty}>
          <div className={ui.emptyIcon}>
            <Icon name="clock" />
          </div>

          <h2>Seu perfil está a caminho.</h2>

          <p>
            Sua conta foi criada, mas ainda não há um perfil de paciente
            associado a ela. Aguarde até que seu perfil seja criado.
          </p>
        </div>
      ) : patientCare ? (
        <div className={styles.welcomePanel}>
          <div>
            <p className={styles.panelEyebrow}>Seu próximo passo</p>

            <h2>Vamos começar seu plano de cuidado?</h2>

            <p>
              Você ainda não tem um PTS ativo. Confira as propostas e escolha a
              equipe que vai construir esse caminho com você.
            </p>
          </div>

          <div className={styles.welcomeDiagram} aria-hidden="true">
            <span>PTS</span>
          </div>
        </div>
      ) : kind === 'professional' ? (
        <div className={styles.welcomePanel}>
          <div>
            <p className={styles.panelEyebrow}>Equipe de cuidado</p>

            <h2>Acompanhe seus planos de cuidado.</h2>

            <p>
              Consulte os PTS dos seus pacientes e crie novas propostas para
              iniciar o planejamento do cuidado.
            </p>

            <Link
              href="/pts/proposals"
              className={`${ui.btn} ${ui.btnPrimary}`}
            >
              Consultar PTS
              <Icon name="arrow" className={ui.icon} />
            </Link>
          </div>

          <div className={styles.welcomeDiagram} aria-hidden="true">
            <span>PTS</span>
          </div>
        </div>
      ) : (
        <div className={styles.welcomePanel}>
          <div>
            <p className={styles.panelEyebrow}>Equipe de cuidado</p>

            <h2>Encontre profissionais para compor a equipe.</h2>

            <p>
              Consulte os profissionais cadastrados e encontre integrantes para
              compor a equipe multidisciplinar.
            </p>

            <Link
              href="/professionals"
              className={`${ui.btn} ${ui.btnPrimary}`}
            >
              Consultar profissionais
              <Icon name="arrow" className={ui.icon} />
            </Link>
          </div>

          <div className={styles.welcomeDiagram} aria-hidden="true">
            <span>PTS</span>
          </div>
        </div>
      )}
    </>
  );
}
