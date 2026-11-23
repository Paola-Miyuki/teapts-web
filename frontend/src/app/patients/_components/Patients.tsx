'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import type { Account } from '@/lib/account';
import { can } from '@/lib/permissions';
import styles from '../patients.module.css';
import AddPatientModal from './AddPatientModal';
import AuthorizedPatients from './AuthorizedPatients';
import PatientList from './PatientList';
import PatientSearch from './PatientSearch';

// O admin consulta e adiciona pacientes cadastrados; o profissional vê os
// pacientes autorizados a ele. Os demais veem o bloqueio, sem chamar a API.
export default function Patients() {
  return (
    <AuthenticatedPage
      currentHref="/patients"
      breadcrumb="Pacientes"
      requiredAction="viewAuthorizedPatients"
    >
      {(account) =>
        can(account, 'viewPatientRegistry') ? (
          <PatientRegistry account={account} />
        ) : (
          <AuthorizedPatients />
        )
      }
    </AuthenticatedPage>
  );
}

function PatientRegistry({ account }: { account: Account }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // O termo fica na URL (/patients?q=) para manter a busca ao recarregar,
  // voltar ou compartilhar o link.
  const search = useDebouncedSearch({
    initialTerm: searchParams.get('q') ?? '',
    onTermChange: (term) =>
      router.replace(
        term ? `/patients?q=${encodeURIComponent(term)}` : '/patients',
        {
          scroll: false,
        },
      ),
  });

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [success, setSuccess] = useState('');
  // Muda a cada paciente adicionado, para a lista recarregar.
  const [listKey, setListKey] = useState(0);

  function openAdd() {
    setSuccess('');
    setIsAddOpen(true);
  }

  function handleAdded(name: string) {
    setIsAddOpen(false);
    setSuccess(`Paciente ${name} adicionado.`);
    setListKey((current) => current + 1);
  }

  return (
    <>
      <div className={`${ui.heading} ${styles.heading}`}>
        <div>
          <h1>Pacientes</h1>

          <p>
            Consulte os pacientes cadastrados e adicione contas existentes como
            pacientes.
          </p>
        </div>

        {can(account, 'createPatientProfile') && (
          <button
            type="button"
            className={`${ui.btn} ${ui.btnPrimary} ${styles.create}`}
            onClick={openAdd}
          >
            <Icon name="plus" className={ui.icon} />
            Adicionar paciente
          </button>
        )}
      </div>

      <>
        {success && (
          <div
            className={`${ui.alert} ${ui.alertSuccess} ${styles.success}`}
            role="status"
          >
            <div className={ui.alertIcon}>
              <Icon name="checkCircle" />
            </div>

            <span>{success}</span>
          </div>
        )}

        <PatientSearch
          value={search.input}
          onChange={search.setInput}
          onCommit={search.commit}
          onClear={search.clear}
        />

        <PatientList
          key={listKey}
          term={search.term}
          onAdd={openAdd}
          canAdd={can(account, 'createPatientProfile')}
        />

        <AddPatientModal
          open={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          onAdded={handleAdded}
          canCreate={can(account, 'createPatientProfile')}
        />
      </>
    </>
  );
}
