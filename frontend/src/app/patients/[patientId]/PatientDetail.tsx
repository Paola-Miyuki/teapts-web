'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import Icon from '@/components/Icon';
import PtsStatusBadge from '@/components/table/PtsStatusBadge';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import type { Account } from '@/lib/account';
import { formatDate, formatPhone } from '@/lib/format';
import { can } from '@/lib/permissions';
import {
  getPatient,
  type PatientDetail as Patient,
  type SupportContact,
} from '@/lib/patients';
import ClinicalDataCard from '../_components/ClinicalDataCard';
import DeletePatientDialog from '../_components/DeletePatientDialog';
import MedicationsCard from '../_components/MedicationsCard';
import SupportContactsCard from '../_components/SupportContactsCard';
import styles from '../patients.module.css';

const LOAD_ERROR = 'Verifique sua conexão e tente novamente';

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
      {(account) => <PatientDetailContent id={id} account={account} />}
    </AuthenticatedPage>
  );
}

function PatientDetailContent({
  id,
  account,
}: {
  id: string;
  account: Account;
}) {
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<'dados' | 'medicacoes'>('dados');
  const [supportContacts, setSupportContacts] = useState<SupportContact[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    getPatient(id, controller.signal)
      .then((response) => {
        setError(null);
        setPatient(response);
        setSupportContacts(response.supportContacts);
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
        <a
          href="#dados"
          aria-current={activeTab === 'dados' ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault();
            setActiveTab('dados');
          }}
        >
          Dados do paciente
        </a>

        <a
          href="#medicacoes"
          aria-current={activeTab === 'medicacoes' ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault();
            setActiveTab('medicacoes');
          }}
        >
          Medicações
        </a>
      </nav>

      {activeTab === 'dados' && (
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
                      <span className="ux-idfact-ic" aria-hidden="true">
                        <Icon name="mail" className="icon-sm" />
                      </span>
                      <dt>E-mail</dt>
                      <dd>{patient.email}</dd>
                    </div>
                    <div>
                      <span className="ux-idfact-ic" aria-hidden="true">
                        <Icon name="phone" className="icon-sm" />
                      </span>
                      <dt>Telefone</dt>
                      <dd>
                        <Value>
                          {patient.phone && formatPhone(patient.phone)}
                        </Value>
                      </dd>
                    </div>
                    <div>
                      <span className="ux-idfact-ic" aria-hidden="true">
                        <Icon name="calendar" className="icon-sm" />
                      </span>
                      <dt>Cadastrado em</dt>
                      <dd>{formatDate(patient.registeredAt)}</dd>
                    </div>
                  </dl>
                </div>

                {account.role === 'admin' && (
                  <button
                    type="button"
                    className="btn btn-danger ux-idedit"
                    onClick={() => setDeleting(true)}
                  >
                    <Icon name="trash" className="icon-sm" />
                    Excluir paciente
                  </button>
                )}

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

              <ClinicalDataCard
                patientId={patient.id}
                data={patient}
                canEdit={can(account, 'manageClinicalData', {
                  patientReadOnly: patient.readOnly,
                })}
                onSaved={(clinicalData) =>
                  setPatient((current) =>
                    current
                      ? {
                          ...current,
                          ...clinicalData,
                        }
                      : current,
                  )
                }
              />

              <SupportContactsCard
                patientId={patient.id}
                patientName={patient.name}
                contacts={supportContacts}
                canEdit={can(account, 'manageSupportContacts', {
                  patientReadOnly: patient.readOnly,
                })}
                onChange={setSupportContacts}
              />
            </div>
          </div>
        </section>
      )}

      {activeTab === 'medicacoes' && (
        <section data-panel="medicacoes" id="medicacoes">
          <MedicationsCard
            patientId={patient.id}
            canEdit={can(account, 'manageMedications', {
              patientReadOnly: patient.readOnly,
            })}
          />
        </section>
      )}

      <DeletePatientDialog
        patient={deleting ? { id: patient.id, name: patient.name } : null}
        onClose={() => setDeleting(false)}
        onDeleted={() => router.replace('/patients')}
      />
    </section>
  );
}
