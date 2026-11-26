'use client';

import { Suspense } from 'react';
import Link from 'next/link';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import Icon from '@/components/Icon';
import AddedNotice from './_components/AddedNotice';
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
            {account.role === 'admin' && (
              <div className="heading-actions">
                <Link className="btn btn-primary" href="/professionals/new">
                  <Icon name="plus" className="icon-sm" />
                  Adicionar profissional
                </Link>
              </div>
            )}
          </div>

          {/* O useSearchParams (busca e filtros) exige um limite de Suspense. */}
          <Suspense>
            <AddedNotice />
            <Professionals isAdmin={account.role === 'admin'} />
          </Suspense>
        </>
      )}
    </AuthenticatedPage>
  );
}
