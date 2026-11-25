'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import Icon from '@/components/Icon';
import type { Account } from '@/lib/account';
import { can } from '@/lib/permissions';

import ProposalTable from './_components/ProposalTable';

// Propostas de `propostas-pts.html`: tabela para o profissional e o admin. O
// paciente decide nos cartões da aba "Propostas de PTS" de /pts.
function ProposalsContent({ account }: { account: Account }) {
  const router = useRouter();
  const isPatient = account.patientProfileId !== null;

  useEffect(() => {
    if (isPatient) {
      router.replace('/pts#propostas');
    }
  }, [isPatient, router]);

  if (isPatient) {
    return null;
  }

  return (
    <>
      <div className="heading">
        <div>
          <h1>Propostas de PTS</h1>
        </div>

        {can(account, 'createPts') && (
          <div className="heading-actions">
            <Link href="/pts/novo" className="btn btn-primary">
              <Icon name="plus" className="icon-sm" />
              Criar proposta
            </Link>
          </div>
        )}
      </div>

      <Suspense fallback={null}>
        <ProposalTable account={account} />
      </Suspense>
    </>
  );
}

export default function PtsProposalsPage() {
  return (
    <AuthenticatedPage
      currentHref="/pts/proposals"
      breadcrumb="Propostas de PTS"
      requiredAction="viewPtsProposals"
    >
      {(account: Account) => <ProposalsContent account={account} />}
    </AuthenticatedPage>
  );
}
