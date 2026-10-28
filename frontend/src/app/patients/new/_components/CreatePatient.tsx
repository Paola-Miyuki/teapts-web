'use client';

import Link from 'next/link';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import CreatePatientForm from './CreatePatientForm';

// Só o admin cria perfil de paciente; os demais veem o bloqueio, sem chamar a API.
export default function CreatePatient() {
  return (
    <AuthenticatedPage
      currentHref="/patients/new"
      breadcrumb="Criar perfil de paciente"
    >
      {(_account, kind) => (
        <>
          <div className={ui.heading}>
            <p className={ui.eyebrow}>Administração de pacientes</p>

            <h1>Criar perfil de paciente</h1>

            <p>
              Associe uma conta existente ao paciente e organize sua rede de
              suporte.
            </p>
          </div>

          {kind === 'admin' ? (
            <CreatePatientForm />
          ) : (
            <div className={ui.empty}>
              <div className={ui.emptyIcon}>
                <Icon name="lock" />
              </div>

              <h2>Acesso restrito ao administrador</h2>

              <p>Somente administradores podem criar perfis de paciente.</p>

              <Link href="/home" className={`${ui.btn} ${ui.btnSecondary}`}>
                Voltar para o início
              </Link>
            </div>
          )}
        </>
      )}
    </AuthenticatedPage>
  );
}
