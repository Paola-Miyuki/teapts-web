'use client';

import { useState } from 'react';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import { can } from '@/lib/permissions';
import styles from '../patients.module.css';
import AddPatientModal from './AddPatientModal';
import PatientList from './PatientList';

// Só o admin consulta e adiciona pacientes; os demais veem o bloqueio, sem
// chamar a API.
export default function Patients() {
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
    <AuthenticatedPage
      currentHref="/patients"
      breadcrumb="Pacientes"
      requiredAction="viewPatientRegistry"
    >
      {(account) => (
        <>
          <div className={`${ui.heading} ${styles.heading}`}>
            <div>
              <h1>Pacientes</h1>

              <p>
                Consulte os pacientes cadastrados e adicione contas existentes
                como pacientes.
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

            <PatientList
              key={listKey}
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
      )}
    </AuthenticatedPage>
  );
}
