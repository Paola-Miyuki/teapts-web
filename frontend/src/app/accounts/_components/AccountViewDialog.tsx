'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';
import { GENDER_LABELS, SEX_LABELS } from '@/lib/account';
import { getAccount, type AccountDetail } from '@/lib/accounts';
import { ApiError } from '@/lib/api';
import {
  formatCpf,
  formatDate,
  formatDateOnly,
  formatPhone,
} from '@/lib/format';
import styles from '../accounts.module.css';
import {
  listHref,
  makePatientHref,
  MAKE_PROFESSIONAL_UNAVAILABLE,
  profileLabel,
} from './AccountProfile';

const LOAD_ERROR = 'Não foi possível carregar a conta';

function EmptyCell() {
  return (
    <span className="empty-cell" aria-label="Não informado">
      —
    </span>
  );
}

function item(label: string, value: ReactNode) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || <EmptyCell />}</dd>
    </div>
  );
}

type AccountViewDialogProps = {
  // Conta da linha escolhida; null com o modal fechado.
  account: { id: string; name: string } | null;
  // Conta já desativada nesta tela (a API ainda não foi relida).
  deactivated: boolean;
  canCreatePatient: boolean;
  onDeactivate: (account: { id: string; name: string }) => void;
  onClose: () => void;
};

// Modal "Dados da conta" de `contas.html`: lê GET /accounts/:id ao abrir.
export default function AccountViewDialog({
  account,
  deactivated,
  canCreatePatient,
  onDeactivate,
  onClose,
}: AccountViewDialogProps) {
  const router = useRouter();
  const accountId = account?.id ?? null;
  const [loaded, setLoaded] = useState<{
    id: string;
    detail?: AccountDetail;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (!accountId) {
      return;
    }

    const controller = new AbortController();

    getAccount(accountId, controller.signal)
      .then((detail) => setLoaded({ id: accountId, detail }))
      .catch((reason: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (reason instanceof ApiError && reason.status === 401) {
          router.replace('/login');
          return;
        }

        setLoaded({
          id: accountId,
          error:
            reason instanceof ApiError && reason.apiMessage
              ? reason.apiMessage
              : LOAD_ERROR,
        });
      });

    return () => controller.abort();
  }, [accountId, router]);

  const current = loaded?.id === accountId ? loaded : null;
  const detail = current?.detail;
  const isActive = detail ? detail.status === 'active' && !deactivated : false;
  const inactive = detail ? !isActive : false;

  return (
    <Modal
      open={account !== null}
      id="account-view"
      size="sm"
      title={account?.name ?? ''}
      onClose={onClose}
      footer={
        <>
          {detail && isActive && account && (
            <button
              type="button"
              className="btn spacer btn-danger"
              onClick={() => onDeactivate(account)}
            >
              <Icon name="lock" className="icon-sm" />
              Desativar
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Fechar
          </button>
        </>
      }
    >
      {current?.error ? (
        <div className={`${ui.alert} ${ui.alertError}`} role="alert">
          <p>{current.error}</p>
        </div>
      ) : !detail ? (
        <div className={styles.modalLoading} role="status">
          <div className={styles.loader} />
          <span className="sr-only">Carregando conta...</span>
        </div>
      ) : (
        <>
          <section>
            <h3>Dados da conta</h3>
            <dl className="data-grid">
              {item('Nome completo', detail.fullName)}
              {item('Nome social', detail.socialName)}
              {item(
                'Data de nascimento',
                detail.birthDate && formatDateOnly(detail.birthDate),
              )}
              {item('Sexo', detail.sex && SEX_LABELS[detail.sex])}
              {item('Gênero', detail.gender && GENDER_LABELS[detail.gender])}
              {item('CPF', detail.cpf && formatCpf(detail.cpf))}
              {item('E-mail', detail.email)}
              {item('Telefone', detail.phone && formatPhone(detail.phone))}
              {item(
                'Papel',
                detail.role === 'admin' ? 'Administrador' : 'Usuário',
              )}
              {item(
                'Situação',
                <span className={`badge ${inactive ? 'inactive' : 'active'}`}>
                  {inactive ? 'Inativa' : 'Ativa'}
                </span>,
              )}
              {item('Criada em', formatDate(detail.createdAt))}
              {item(
                'Atualizada em',
                detail.updatedAt && formatDate(detail.updatedAt),
              )}
            </dl>
          </section>

          <section>
            <h3>Perfil</h3>
            {detail.profile.type === 'admin' ? (
              <p className="muted">Conta de administrador.</p>
            ) : detail.profile.type === 'none' ? (
              <>
                <p className="muted">Esta conta ainda não tem perfil.</p>
                {canCreatePatient && !inactive && (
                  <div className="heading-actions">
                    <Link className="btn" href={makePatientHref(detail.id)}>
                      <Icon name="patient" className="icon-sm" />
                      Tornar paciente
                    </Link>
                    <button
                      type="button"
                      className="btn"
                      disabled
                      title={MAKE_PROFESSIONAL_UNAVAILABLE}
                    >
                      <Icon name="people" className="icon-sm" />
                      Tornar profissional
                    </button>
                  </div>
                )}
              </>
            ) : (
              <ul className="mini-list">
                <li>
                  <span className="grow">
                    <strong>
                      {profileLabel(
                        detail.profile.type,
                        detail.profile.specialisms,
                      )}
                    </strong>
                  </span>
                  <Link
                    className="link"
                    href={listHref(detail.profile.type, detail.email)}
                  >
                    Ver na lista
                  </Link>
                </li>
              </ul>
            )}
          </section>
        </>
      )}
    </Modal>
  );
}
