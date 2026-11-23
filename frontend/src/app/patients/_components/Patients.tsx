'use client';

import { useState } from 'react';
import Link from 'next/link';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import type { Account } from '@/lib/account';
import { can } from '@/lib/permissions';
import styles from '../patients.module.css';
import AddPatientModal from './AddPatientModal';
import PatientList from './PatientList';

// Pacientes de `pacientes.html`: o admin vê todos e adiciona; o profissional vê
// os dos PTS de que faz ou fez parte (RN016). Os demais veem o bloqueio.
export default function Patients() {
  return (
    <AuthenticatedPage
      currentHref="/patients"
      breadcrumb="Pacientes"
      requiredAction="viewAuthorizedPatients"
    >
      {(account) => <PatientsContent account={account} />}
    </AuthenticatedPage>
  );
}

function PatientsContent({ account }: { account: Account }) {
  const isAdmin = can(account, 'viewPatientRegistry');
  const canCreate = can(account, 'createPatientProfile');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [success, setSuccess] = useState('');
  const [listKey, setListKey] = useState(0);

  function handleAdded(name: string) {
    setIsAddOpen(false);
    setSuccess(`Paciente ${name} adicionado.`);
    setListKey((current) => current + 1);
  }

  return (
    <>
      <div className="heading">
        <div>
          <h1>Pacientes</h1>
        </div>

        <div className="heading-actions">
          {canCreate && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setSuccess('');
                setIsAddOpen(true);
              }}
            >
              <Icon name="plus" className="icon-sm" />
              Adicionar paciente
            </button>
          )}

          {!isAdmin && (
            <Link href="/pts/novo" className="btn btn-primary">
              <Icon name="plus" className="icon-sm" />
              Criar proposta de PTS
            </Link>
          )}
        </div>
      </div>

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

      <PatientList isAdmin={isAdmin} reloadKey={listKey} />

      {canCreate && (
        <AddPatientModal
          open={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          onAdded={handleAdded}
          canCreate={canCreate}
        />
      )}
    </>
  );
}
