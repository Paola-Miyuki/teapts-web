'use client';

import { Suspense } from 'react';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import Professionals from './_components/Professionals';

export default function ProfessionalsPage() {
  return (
    <AuthenticatedPage
      currentHref="/professionals"
      breadcrumb="Profissionais"
      requiredAction="viewProfessionalDirectory"
    >
      {(account) => (
        <>
          <div className="heading">
            <div>
              <h1>Profissionais</h1>
            </div>
          </div>

          {/* O useSearchParams (busca e filtros) exige um limite de Suspense. */}
          <Suspense>
            <Professionals isAdmin={account.role === 'admin'} />
          </Suspense>
        </>
      )}
    </AuthenticatedPage>
  );
}
