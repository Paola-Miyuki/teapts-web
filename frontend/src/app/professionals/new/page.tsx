'use client';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import CreateProfessionalForm from './_components/CreateProfessionalForm';

// "Adicionar profissional" (RFPRO002, `criar-profissional.html`): só o admin.
export default function NewProfessionalPage() {
  return (
    <AuthenticatedPage
      currentHref="/professionals"
      breadcrumb={[
        { label: 'Profissionais', href: '/professionals' },
        { label: 'Adicionar profissional' },
      ]}
      requiredAction="createProfessional"
      deniedTitle="Acesso restrito ao administrador"
    >
      <>
        <div className="heading">
          <div>
            <h1>Adicionar profissional</h1>
          </div>
        </div>

        <CreateProfessionalForm />
      </>
    </AuthenticatedPage>
  );
}
