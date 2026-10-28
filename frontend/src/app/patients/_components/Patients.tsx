'use client';

import { useState } from 'react';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import styles from '../patients.module.css';
import AddPatientModal from './AddPatientModal';
import AdminOnly from './AdminOnly';
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
    <AuthenticatedPage currentHref="/patients" breadcrumb="Pacientes">
      {(_account, kind) => (
        <>
          <div className={`${ui.heading} ${styles.heading}`}>
            <div>
              <p className={ui.eyebrow}>Administração de pacientes</p>

              <h1>Pacientes</h1>

              <p>
                Consulte os pacientes cadastrados e adicione contas existentes
                como pacientes.
              </p>
            </div>

            {kind === 'admin' && (
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

          {kind === 'admin' ? (
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

              <PatientList key={listKey} onAdd={openAdd} />

              <AddPatientModal
                open={isAddOpen}
                onClose={() => setIsAddOpen(false)}
                onAdded={handleAdded}
              />
            </>
          ) : (
            <AdminOnly message="Somente administradores podem consultar e adicionar pacientes." />
          )}
        </>
      )}
    </AuthenticatedPage>
  );
}
