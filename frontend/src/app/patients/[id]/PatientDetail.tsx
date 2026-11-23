'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import Icon from '@/components/Icon';
import PtsStatusBadge from '@/components/table/PtsStatusBadge';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { getPatient, type PatientDetail as Patient } from '@/lib/patients';
import styles from '../patients.module.css';

const LOAD_ERROR = 'Verifique sua conexão e tente novamente.';

function initials(name: string) {
  const parts = name.trim().split(/\s+/);

  return `${parts[0]?.charAt(0) ?? ''}${parts.length > 1 ? parts[parts.length - 1].charAt(0) : ''}`.toUpperCase();
}

function formatCpf(cpf: string) {
  return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

function formatCns(cns: string) {
  return cns.replace(/^(\d{3})(\d{4})(\d{4})(\d{4})$/, '$1 $2 $3 $4');
}

function Value({ children }: { children: React.ReactNode }) {
  return children ? (
    <>{children}</>
  ) : (
    <span className="empty-cell" aria-label="Não informado">
      —
    </span>
  );
}

// Detalhe do paciente (`paciente.html`, aba Dados do paciente): admin ou
// profissional com acesso pela RN016. Só mostra os dados que a API já tem.
export default function PatientDetail({ id }: { id: string }) {
  return (
    <AuthenticatedPage
      currentHref="/patients"
      breadcrumb="Pacientes"
      requiredAction="viewAuthorizedPatients"
    >
      <PatientDetailContent id={id} />
    </AuthenticatedPage>
  );
}

function PatientDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    getPatient(id, controller.signal)
      .then((response) => {
        setError(null);
        setPatient(response);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (reason instanceof ApiError && reason.status === 401) {
          router.replace('/login');
          return;
        }

        setError(reason);
      });

    return () => controller.abort();
  }, [id, retryKey, router]);

  if (error) {
    const status = error instanceof ApiError ? error.status : 0;
    const title =
      status === 404
        ? 'Paciente não encontrado'
        : status === 403
          ? 'Sem acesso a este paciente'
          : 'Não foi possível carregar o paciente';

    return (
      <div className={ui.empty} role="alert">
        <div className={ui.emptyIcon}>
          <Icon name="alertCircle" />
        </div>
        <h2>{title}</h2>
        <p>
          {error instanceof ApiError && error.apiMessage
            ? error.apiMessage
            : LOAD_ERROR}
        </p>
        {status === 403 || status === 404 ? (
          <Link href="/patients" className={`${ui.btn} ${ui.btnSecondary}`}>
            Voltar para pacientes
          </Link>
        ) : (
          <button
            type="button"
            className={`${ui.btn} ${ui.btnSecondary}`}
            onClick={() => setRetryKey((current) => current + 1)}
          >
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  if (!patient) {
    return (
      <div className={ui.empty} role="status" aria-live="polite">
        <div className={styles.loader} />
        <p>Carregando paciente...</p>
      </div>
    );
  }

  return (
    <section>
      <nav className="tabs ux-ptabs" aria-label="Seções do paciente">
        <a href="#dados" aria-current="page">
          Dados do paciente
        </a>
      </nav>

      <section data-panel="dados" id="dados">
        <div className="ux-profile">
          <div className="ux-profile-side">
            <section className="ux-card ux-idcard" aria-labelledby="pat-id">
              <div className="ux-idhead">
                <span className="photo" aria-hidden="true">
                  {initials(patient.name)}
                </span>
                <h2 id="pat-id">{patient.name}</h2>
                <div className="ux-badges">
                  <PtsStatusBadge status={patient.ptsStatus} />
                </div>
              </div>

              <div className="ux-idaccount">
                <h3>Dados da conta</h3>
                <dl className="ux-idfacts">
                  <div>
                    <dt>E-mail</dt>
                    <dd>{patient.email}</dd>
                  </div>
                  <div>
                    <span className="ux-idfact-ic" aria-hidden="true">
                      <Icon name="calendar" className="icon-sm" />
                    </span>
                    <dt>Cadastrado em</dt>
                    <dd>
                      {new Date(patient.registeredAt).toLocaleDateString(
                        'pt-BR',
                        { timeZone: 'UTC' },
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              {patient.readOnly && (
                <p className="hint">
                  Somente leitura: o PTS de que você fez parte está encerrado.
                </p>
              )}
            </section>
          </div>

          <div className="ux-profile-main">
            <section className="ux-card" aria-labelledby="d-personal">
              <div className="ux-card-head">
                <div>
                  <h2 id="d-personal">Dados pessoais</h2>
                </div>
              </div>

              <div className="ux-psec">
                <h3>Identificação</h3>
                <dl className="ux-dl">
                  <div>
                    <dt>Nome completo</dt>
                    <dd>{patient.name}</dd>
                  </div>
                  <div>
                    <dt>Nome social</dt>
                    <dd>
                      <Value>{patient.socialName}</Value>
                    </dd>
                  </div>
                  <div>
                    <dt>CPF</dt>
                    <dd>
                      <Value>{patient.cpf && formatCpf(patient.cpf)}</Value>
                    </dd>
                  </div>
                  <div>
                    <dt>CNS (Cartão SUS)</dt>
                    <dd>
                      <Value>{patient.cns && formatCns(patient.cns)}</Value>
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="ux-psec">
                <h3>Responsável tutelar</h3>
                <dl className="ux-dl">
                  <div>
                    <dt>Responsável tutelar</dt>
                    <dd>
                      <Value>{patient.guardianName}</Value>
                    </dd>
                  </div>
                </dl>
              </div>
            </section>

            <section className="ux-card" aria-labelledby="d-support">
              <div className="ux-card-head">
                <div>
                  <h2 id="d-support">Contatos de suporte</h2>
                </div>
              </div>

              {patient.supportContacts.length === 0 ? (
                <p className="hint">Nenhum contato de suporte cadastrado.</p>
              ) : (
                <ul className="ux-contact-tiles">
                  {patient.supportContacts.map((contact, index) => (
                    <li className="ux-contact-tile" key={`${contact.name}-${index}`}>
                      <span className="avatar" aria-hidden="true">
                        {initials(contact.name)}
                      </span>
                      <div>
                        <strong>{contact.name}</strong>
                        {contact.description && (
                          <small className="ux-sub">
                            <span className="ux-sublabel">Descrição:</span>{' '}
                            {contact.description}
                          </small>
                        )}
                        {contact.email && (
                          <small className="ux-sub">
                            <span className="ux-sublabel">E-mail:</span>{' '}
                            {contact.email}
                          </small>
                        )}
                        {contact.phone && (
                          <small className="ux-sub">
                            <span className="ux-sublabel">Telefone:</span>{' '}
                            {contact.phone}
                          </small>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </section>
    </section>
  );
}
