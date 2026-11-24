'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import Icon from '@/components/Icon';
import KebabMenu from '@/components/table/KebabMenu';
import MultiSelect from '@/components/table/MultiSelect';
import Pagination, { PER_PAGE_OPTIONS } from '@/components/table/Pagination';
import ui from '@/components/ui.module.css';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import type { Account } from '@/lib/account';
import {
  getAccounts,
  PROFILE_FILTERS,
  type AccountListItem,
  type AccountProfileFilter,
  type AccountSort,
  type AccountStatus,
  type AccountsListResponse,
} from '@/lib/accounts';
import { ApiError } from '@/lib/api';
import { formatCpf, formatDate } from '@/lib/format';
import { can } from '@/lib/permissions';
import styles from '../accounts.module.css';
import AccountViewDialog from './AccountViewDialog';
import {
  makePatientHref,
  MAKE_PROFESSIONAL_UNAVAILABLE,
  profileLabel,
} from './AccountProfile';
import DeactivateAccountDialog from './DeactivateAccountDialog';

const LOAD_ERROR = 'Verifique sua conexão e tente novamente';
const DEFAULT_LIMIT = PER_PAGE_OPTIONS[0];
const RANGE_DAYS: Record<string, number> = { '30': 30, '90': 90 };

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

function EmptyCell() {
  return (
    <span className="empty-cell" aria-label="Não informado">
      —
    </span>
  );
}

// Contas de `contas.html` (RN032): só o admin; os demais veem o bloqueio.
export default function Accounts() {
  return (
    <AuthenticatedPage
      currentHref="/accounts"
      breadcrumb="Contas"
      requiredAction="manageAccounts"
    >
      {(account) => <AccountsContent account={account} />}
    </AuthenticatedPage>
  );
}

type Target = { id: string; name: string };

function AccountsContent({ account }: { account: Account }) {
  const canCreatePatient = can(account, 'createPatientProfile');
  const router = useRouter();
  const searchParams = useSearchParams();

  const profile = (searchParams.get('profile') ?? '')
    .split(',')
    .filter((value): value is AccountProfileFilter =>
      PROFILE_FILTERS.some((option) => option.value === value),
    );
  const statusParam = searchParams.get('status');
  const status: AccountStatus | '' =
    statusParam === 'active' || statusParam === 'inactive' ? statusParam : '';
  const created = searchParams.get('created') ?? '';
  const createdFromParam = searchParams.get('createdFrom') ?? '';
  const createdToParam = searchParams.get('createdTo') ?? '';
  const sort: AccountSort =
    searchParams.get('sort') === 'createdAt' ? 'createdAt' : 'name';
  const order = searchParams.get('order') === 'desc' ? 'desc' : 'asc';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limitParam = Number(searchParams.get('limit'));
  const limit = PER_PAGE_OPTIONS.includes(limitParam)
    ? limitParam
    : DEFAULT_LIMIT;

  // Grava os parâmetros na URL; mudar busca ou filtro volta à página 1.
  function update(changes: Record<string, string>, keepPage = false) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    if (!keepPage) {
      params.delete('page');
    }

    const query = params.toString();
    router.replace(query ? `/accounts?${query}` : '/accounts', {
      scroll: false,
    });
  }

  const search = useDebouncedSearch({
    initialTerm: searchParams.get('q') ?? '',
    onTermChange: (term) => update({ q: term }),
  });

  const hasFilters = profile.length > 0 || Boolean(status || created);
  const [filtersOpen, setFiltersOpen] = useState(hasFilters);

  const range = useMemo(() => {
    if (created === 'custom') {
      return { from: createdFromParam, to: createdToParam };
    }

    const days = RANGE_DAYS[created];

    if (!days) {
      return { from: '', to: '' };
    }

    const from = new Date();
    from.setDate(from.getDate() - days);

    return { from: isoDate(from), to: '' };
  }, [created, createdFromParam, createdToParam]);

  const [retryKey, setRetryKey] = useState(0);
  const key = [
    search.term,
    profile.join(','),
    status,
    range.from,
    range.to,
    sort,
    order,
    page,
    limit,
    retryKey,
  ].join('\n');
  const [last, setLast] = useState<{
    key: string;
    response: AccountsListResponse;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    error: unknown;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getAccounts({
      page,
      limit,
      q: search.term,
      profile,
      status,
      createdFrom: range.from,
      createdTo: range.to,
      sort: sort === 'name' ? undefined : sort,
      order: order === 'asc' ? undefined : order,
      signal: controller.signal,
    })
      .then((response) => {
        if (!controller.signal.aborted) {
          setLast({ key, response });
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

        setFailure({ key, error });
      });

    return () => controller.abort();
    // `key` resume todos os parâmetros da consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Contas desativadas aqui: a linha vira "Inativa" sem reler a lista.
  const [deactivatedIds, setDeactivatedIds] = useState<string[]>([]);
  const [viewing, setViewing] = useState<Target | null>(null);
  const [deactivating, setDeactivating] = useState<Target | null>(null);
  const [success, setSuccess] = useState('');

  function handleDeactivated(id: string, name: string) {
    setDeactivatedIds((current) => [...current, id]);
    setDeactivating(null);
    setSuccess(`Conta de ${name} desativada`);
  }

  const loading = last?.key !== key;
  const total = last?.response.pagination.total ?? 0;
  const filtered = Boolean(search.term) || hasFilters;
  const count = last
    ? `${total} ${total === 1 ? 'conta' : 'contas'}${filtered ? ' com os filtros atuais' : ''}`
    : 'Carregando...';

  function clearFilters() {
    update({
      profile: '',
      status: '',
      created: '',
      createdFrom: '',
      createdTo: '',
    });
  }

  function isInactive(item: AccountListItem) {
    return item.status === 'inactive' || deactivatedIds.includes(item.id);
  }

  return (
    <>
      <div className="heading">
        <div>
          <h1>Contas</h1>
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

      <div className="ux-tcard" aria-busy={loading}>
        <div className="ux-tcard-head">
          <div>
            <h2>Contas cadastradas</h2>
            <p className="count" aria-live="polite">
              {count}
            </p>
          </div>
        </div>

        <div className="ux-toolbar">
          <label className="field">
            <span>Busca</span>
            <span className="with-icon">
              <Icon name="search" className="icon-sm" />
              <input
                className="input"
                type="search"
                placeholder="Nome, CPF ou e-mail"
                value={search.input}
                onChange={(event) => search.setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    search.commit();
                  }

                  if (event.key === 'Escape') {
                    search.clear();
                  }
                }}
              />
            </span>
          </label>

          <div className="ux-tools">
            <button
              type="button"
              className="btn filter-toggle"
              aria-expanded={filtersOpen}
              aria-controls="accounts-more"
              onClick={() => setFiltersOpen((current) => !current)}
            >
              <Icon name="filter" className="icon-sm" />
              Filtros
            </button>

            {hasFilters && (
              <button type="button" className="btn" onClick={clearFilters}>
                <Icon name="close" className="icon-sm" />
                Limpar
              </button>
            )}

            <label className="ux-sort" htmlFor="accounts-sort">
              <span>Ordenar por</span>
              <select
                className="select"
                id="accounts-sort"
                value={sort}
                onChange={(event) =>
                  update({
                    sort: event.target.value === 'createdAt' ? 'createdAt' : '',
                  })
                }
              >
                <option value="name">Nome</option>
                <option value="createdAt">Data de criação</option>
              </select>
              <button
                type="button"
                className="btn btn-sm sort-dir"
                data-dir={order}
                aria-label={
                  order === 'asc' ? 'Ordem crescente' : 'Ordem decrescente'
                }
                onClick={() => update({ order: order === 'asc' ? 'desc' : '' })}
              >
                <Icon
                  name={order === 'asc' ? 'sortUp' : 'sortDown'}
                  className="icon-sm"
                />
              </button>
            </label>
          </div>
        </div>

        <div className="filter-more" id="accounts-more" hidden={!filtersOpen}>
          <MultiSelect
            label="Perfil"
            placeholder="Todos"
            options={PROFILE_FILTERS}
            value={profile}
            onChange={(value) => update({ profile: value.join(',') })}
          />

          <label className="field">
            <span>Situação</span>
            <select
              className="select"
              value={status}
              onChange={(event) => update({ status: event.target.value })}
            >
              <option value="">Ativas e inativas</option>
              <option value="active">Ativa</option>
              <option value="inactive">Inativa</option>
            </select>
          </label>

          <div className="field">
            <label className="field-label" htmlFor="accounts-created">
              Data de criação
            </label>
            <select
              className="select"
              id="accounts-created"
              value={created}
              onChange={(event) =>
                update({
                  created: event.target.value,
                  createdFrom: '',
                  createdTo: '',
                })
              }
            >
              <option value="">Qualquer data</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="custom">Personalizado</option>
            </select>

            {created === 'custom' && (
              <div className="range-custom">
                <input
                  className="input"
                  type="date"
                  aria-label="De"
                  value={createdFromParam}
                  onChange={(event) =>
                    update({ createdFrom: event.target.value })
                  }
                />
                <input
                  className="input"
                  type="date"
                  aria-label="Até"
                  value={createdToParam}
                  onChange={(event) =>
                    update({ createdTo: event.target.value })
                  }
                />
              </div>
            )}
          </div>
        </div>

        {failure?.key === key ? (
          <div className={ui.empty} role="alert">
            <div className={ui.emptyIcon}>
              <Icon name="alertCircle" />
            </div>
            <h2>Não foi possível carregar as contas</h2>
            <p>
              {failure.error instanceof ApiError && failure.error.apiMessage
                ? failure.error.apiMessage
                : LOAD_ERROR}
            </p>
            <button
              type="button"
              className={`${ui.btn} ${ui.btnSecondary}`}
              onClick={() => setRetryKey((current) => current + 1)}
            >
              Tentar novamente
            </button>
          </div>
        ) : !last ? (
          <div className={ui.empty} role="status" aria-live="polite">
            <div className={styles.loader} />
            <p>Carregando contas...</p>
          </div>
        ) : last.response.data.length === 0 ? (
          <div className={ui.empty}>
            <div className={ui.emptyIcon}>
              <Icon name="search" />
            </div>
            <h2>Nenhuma conta encontrada</h2>
            <p>
              {filtered
                ? 'Revise a busca ou os filtros.'
                : 'As contas cadastradas aparecem aqui.'}
            </p>
          </div>
        ) : (
          <>
            <div className={`table-wrap ${loading ? styles.refreshing : ''}`}>
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Conta</th>
                    <th scope="col">E-mail</th>
                    <th scope="col">CPF</th>
                    <th scope="col">Perfil</th>
                    <th scope="col">Situação</th>
                    <th scope="col">Criada em</th>
                    <th scope="col" className="actions-col">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {last.response.data.map((item) => {
                    const inactive = isInactive(item);

                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="person">
                            <span className="avatar" aria-hidden="true">
                              {initial(item.name)}
                            </span>
                            <div>
                              <strong>{item.name}</strong>
                            </div>
                          </div>
                        </td>
                        <td>{item.email}</td>
                        <td className="num">
                          {item.cpf ? formatCpf(item.cpf) : <EmptyCell />}
                        </td>
                        <td>
                          <span
                            className={`badge ${item.profile === 'none' ? 'none' : 'plain'}`}
                          >
                            {profileLabel(item.profile, item.specialisms)}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${inactive ? 'inactive' : 'active'}`}
                          >
                            {inactive ? 'Inativa' : 'Ativa'}
                          </span>
                        </td>
                        <td className="num">{formatDate(item.createdAt)}</td>
                        <td className="actions-col">
                          <KebabMenu label={`Ações para ${item.name}`}>
                            <li>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() =>
                                  setViewing({ id: item.id, name: item.name })
                                }
                              >
                                <Icon name="eye" className="icon-sm" />
                                Visualizar
                              </button>
                            </li>
                            {item.profile === 'none' &&
                              canCreatePatient &&
                              !inactive && (
                                <>
                                  <li>
                                    <Link
                                      role="menuitem"
                                      href={makePatientHref(item.id)}
                                    >
                                      <Icon
                                        name="patient"
                                        className="icon-sm"
                                      />
                                      Tornar paciente
                                    </Link>
                                  </li>
                                  <li>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      disabled
                                      title={MAKE_PROFESSIONAL_UNAVAILABLE}
                                    >
                                      <Icon name="people" className="icon-sm" />
                                      Tornar profissional
                                    </button>
                                  </li>
                                </>
                              )}
                            {item.profile === 'admin' && (
                              <li>
                                <p className="note">
                                  Conta de administrador não recebe perfil de
                                  paciente nem de profissional.
                                </p>
                              </li>
                            )}
                            {!inactive && (
                              <li>
                                <div className="sep" />
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="danger"
                                  onClick={() =>
                                    setDeactivating({
                                      id: item.id,
                                      name: item.name,
                                    })
                                  }
                                >
                                  <Icon name="lock" className="icon-sm" />
                                  Desativar
                                </button>
                              </li>
                            )}
                          </KebabMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              label="Paginação de contas"
              page={last.response.pagination.page}
              limit={limit}
              total={last.response.pagination.total}
              totalPages={last.response.pagination.totalPages}
              onPageChange={(next) =>
                update({ page: next > 1 ? String(next) : '' }, true)
              }
              onLimitChange={(next) =>
                update({ limit: next === DEFAULT_LIMIT ? '' : String(next) })
              }
            />
          </>
        )}
      </div>

      <AccountViewDialog
        account={viewing}
        deactivated={viewing ? deactivatedIds.includes(viewing.id) : false}
        canCreatePatient={canCreatePatient}
        onDeactivate={setDeactivating}
        onClose={() => setViewing(null)}
      />

      <DeactivateAccountDialog
        account={deactivating}
        onClose={() => setDeactivating(null)}
        onDeactivated={handleDeactivated}
      />
    </>
  );
}
