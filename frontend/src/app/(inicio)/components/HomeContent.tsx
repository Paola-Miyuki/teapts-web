import Link from 'next/link';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import type { ProfileKind } from '@/lib/account';
import styles from '../inicio.module.css';

type HomeContentProps = {
  kind: ProfileKind;
  name: string;
};

const EYEBROWS: Record<ProfileKind, string> = {
  admin: 'Área administrativa',
  professional: 'Área profissional',
  patient: 'Área do paciente',
  waiting: 'Área do paciente',
};

export default function HomeContent({ kind, name }: HomeContentProps) {
  const firstName = name.trim().split(/\s+/)[0] ?? '';
  const isPatientArea = kind === 'patient' || kind === 'waiting';

  return (
    <>
      <div className={ui.heading}>
        <p className={ui.eyebrow}>{EYEBROWS[kind]}</p>

        <h1>{firstName ? `Boas-vindas, ${firstName}.` : 'Boas-vindas.'}</h1>

        <p>
          {isPatientArea
            ? 'Um espaço para acompanhar seu cuidado e as pessoas que fazem parte dele.'
            : 'Acompanhe seus pacientes e construa planos de cuidado com a equipe multidisciplinar.'}
        </p>
      </div>

      {kind === 'waiting' ? (
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
      ) : kind === 'patient' ? (
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
              href="/profissionais"
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
