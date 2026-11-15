'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import SupportContactList from '@/app/patients/_components/SupportContactList';
import SupportContactsModal from '@/app/patients/_components/SupportContactsModal';
import { ApiError } from '@/lib/api';
import { getSupportContacts, type SupportContact } from '@/lib/patients';
import styles from '../profile.module.css';

const LOAD_ERROR = 'Não foi possível carregar seus contatos de suporte.';

type SupportContactsCardProps = {
  // accountId do perfil de paciente da sessão.
  patientId: string;
  patientName: string;
  onFeedback: (message: string) => void;
};

// Seção "Contatos de suporte" do paciente em /profile (RFPAC003): mostra a
// lista atual e abre o SupportContactsModal para editar.
export default function SupportContactsCard({
  patientId,
  patientName,
  onFeedback,
}: SupportContactsCardProps) {
  const router = useRouter();

  const [contacts, setContacts] = useState<SupportContact[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    getSupportContacts(patientId, { signal: controller.signal })
      .then((profile) => {
        if (!controller.signal.aborted) {
          setContacts(profile.supportContacts);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          router.replace('/login');
          return;
        }

        setLoadError(
          error instanceof ApiError && error.apiMessage
            ? error.apiMessage
            : LOAD_ERROR,
        );
      });

    return () => controller.abort();
  }, [patientId, retryKey, router]);

  function renderContent() {
    if (loadError) {
      return (
        <div className={`${ui.alert} ${ui.alertError}`} role="alert">
          <div className={`${ui.alertIcon} ${ui.alertIconError}`}>
            <Icon name="alertCircle" />
          </div>

          <div>
            <span>{loadError}</span>

            <button
              type="button"
              className={`${ui.btn} ${ui.btnSecondary} ${styles.retry}`}
              onClick={() => {
                setLoadError('');
                setRetryKey((current) => current + 1);
              }}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }

    if (contacts === null) {
      return (
        <p className={styles.contactsStatus} role="status" aria-live="polite">
          Carregando contatos...
        </p>
      );
    }

    if (contacts.length === 0) {
      return (
        <p className={styles.contactsStatus}>
          Nenhum contato de suporte cadastrado.
        </p>
      );
    }

    return <SupportContactList contacts={contacts} />;
  }

  return (
    <section
      className={`${ui.card} ${styles.card} ${styles.contactsCard}`}
      aria-labelledby="support-contacts-heading"
    >
      <h2 id="support-contacts-heading" className={styles.sectionTitle}>
        Contatos de suporte
      </h2>

      <p className={styles.note}>
        Pessoas que ajudam no seu cuidado. Um contato de suporte não é
        responsável tutelar e não acessa informações clínicas.
      </p>

      {renderContent()}

      <div className={styles.actions}>
        <button
          type="button"
          className={`${ui.btn} ${ui.btnSecondary}`}
          disabled={contacts === null}
          onClick={() => {
            onFeedback('');
            setModalOpen(true);
          }}
        >
          <Icon name="edit" className={ui.icon} />
          Editar contatos
        </button>
      </div>

      <SupportContactsModal
        patient={modalOpen ? { id: patientId, name: patientName } : null}
        onClose={() => setModalOpen(false)}
        onSaved={(saved) => {
          setContacts(saved);
          setModalOpen(false);
          onFeedback('Seus contatos de suporte foram atualizados.');
        }}
      />
    </section>
  );
}
