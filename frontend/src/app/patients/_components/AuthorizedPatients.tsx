'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import styles from '../patients.module.css';
import AuthorizedPatientList from './AuthorizedPatientList';
import PatientSearch from './PatientSearch';

// Pacientes autorizados ao profissional (RFPAC002), com busca pelo nome.
export default function AuthorizedPatients() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // O termo fica na URL (/patients?name=) para manter a busca ao recarregar,
  // voltar ou compartilhar o link.
  const search = useDebouncedSearch({
    initialTerm: searchParams.get('name') ?? '',
    onTermChange: (term) =>
      router.replace(
        term ? `/patients?name=${encodeURIComponent(term)}` : '/patients',
        { scroll: false },
      ),
  });

  return (
    <>
      <div className={`${ui.heading} ${styles.heading}`}>
        <div>
          <h1>Pacientes</h1>

          <p>
            Acompanhe os pacientes vinculados a você e acesse seus planos de
            cuidado.
          </p>
        </div>

        <Link
          href="/pts/novo"
          className={`${ui.btn} ${ui.btnPrimary} ${styles.create}`}
        >
          <Icon name="plus" className={ui.icon} />
          Criar proposta de PTS
        </Link>
      </div>

      <PatientSearch
        label="Buscar paciente pelo nome"
        value={search.input}
        onChange={search.setInput}
        onCommit={search.commit}
        onClear={search.clear}
      />

      <AuthorizedPatientList term={search.term} />
    </>
  );
}
