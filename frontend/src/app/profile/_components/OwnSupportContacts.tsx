'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import SupportContactsCard from '@/app/patients/_components/SupportContactsCard';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { getSupportContacts, type SupportContact } from '@/lib/patients';

const LOAD_ERROR = 'Não foi possível carregar seus contatos de suporte';

// Contatos de suporte do próprio paciente em Meu perfil, só leitura
// (RFPAC003): quem edita é o admin ou a equipe do PTS ativo.
export default function OwnSupportContacts({
  patientId,
  patientName,
}: {
  patientId: string;
  patientName: string;
}) {
  const router = useRouter();
  const [contacts, setContacts] = useState<SupportContact[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    getSupportContacts(patientId, { signal: controller.signal })
      .then((response) => setContacts(response.data))
      .catch((reason: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (reason instanceof ApiError && reason.status === 401) {
          router.replace('/login');
          return;
        }

        setError(
          reason instanceof ApiError && reason.apiMessage
            ? reason.apiMessage
            : LOAD_ERROR,
        );
      });

    return () => controller.abort();
  }, [patientId, router]);

  if (error) {
    return (
      <div className={`${ui.alert} ${ui.alertError}`} role="alert">
        <p>{error}</p>
      </div>
    );
  }

  if (!contacts) {
    return null;
  }

  return (
    <SupportContactsCard
      patientId={patientId}
      patientName={patientName}
      contacts={contacts}
      canEdit={false}
      onChange={setContacts}
    />
  );
}
