'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import Icon from '@/components/Icon';
import KebabMenu from '@/components/table/KebabMenu';
import MultiSelect, { type MultiOption } from '@/components/table/MultiSelect';
import Pagination, { PER_PAGE_OPTIONS } from '@/components/table/Pagination';
import PtsStatusBadge from '@/components/table/PtsStatusBadge';
import ui from '@/components/ui.module.css';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { ApiError } from '@/lib/api';
import {
  getPatients,
  type PatientSort,
  type PatientStatusFilter,
  type PatientsListResponse,
  type SortOrder,
} from '@/lib/patients';
import { getProfessionals, type Professional } from '@/lib/professionals';
import { formatDate } from '@/lib/format';
import { PTS_STATUS_LABELS } from '@/lib/pts-status';
import styles from '../patients.module.css';
import DeletePatientDialog from './DeletePatientDialog';

const LOAD_ERROR = 'Verifique sua conexão e tente novamente';
const DEFAULT_LIMIT = PER_PAGE_OPTIONS[0];

// Opções do filtro Status do PTS por papel (telas-listagem, RN016).
const ADMIN_STATUS: PatientStatusFilter[] = [
  'draft',
  'planning',
  'running',
  'concluded',
  'cancelled',
  'rejected',
  'none',
];
const PROFESSIONAL_STATUS: PatientStatusFilter[] = [
  'planning',
  'running',
  'concluded',
  'cancelled',
];

function statusOptions(isAdmin: boolean): MultiOption[] {
  return (isAdmin ? ADMIN_STATUS : PROFESSIONAL_STATUS).map((value) => ({
    value,
    label: value === 'none' ? 'Sem PTS' : PTS_STATUS_LABELS[value],
  }));
}

const RANGE_DAYS: Record<string, number> = { '30': 30, '90': 90 };

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

// CNS em grupos de 3, 4, 4 e 4 dígitos, como nos mockups.
function formatCns(cns: string) {
  const digits = cns.replace(/\D/g, '');

  return digits.length === 15
    ? digits.replace(/^(\d{3})(\d{4})(\d{4})(\d{4})$/, '$1 $2 $3 $4')
    : cns;
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

type PatientListProps = {
  isAdmin: boolean;
  // Muda a cada paciente adicionado, para recarregar a lista.
  reloadKey?: number;
};

// Lista de pacientes de `pacientes.html` (RFPAC002): busca, filtros,
// ordenação e paginação ficam na URL para valer ao recarregar e ao voltar.
export default function PatientList({
  isAdmin,
  reloadKey = 0,
}: PatientListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const status = (searchParams.get('status') ?? '')
    .split(',')
    .filter(Boolean) as PatientStatusFilter[];
  const responsibleId = searchParams.get('responsible') ?? '';
  const registered = searchParams.get('registered') ?? '';
  const registeredFromParam = searchParams.get('registeredFrom') ?? '';
  const registeredToParam = searchParams.get('registeredTo') ?? '';
  const sort: PatientSort =
    searchParams.get('sort') === 'registeredAt' ? 'registeredAt' : 'name';
  const order: SortOrder =
    searchParams.get('order') === 'desc' ? 'desc' : 'asc';
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
    router.replace(query ? `/patients?${query}` : '/patients', {
      scroll: false,
    });
  }

  const search = useDebouncedSearch({
    initialTerm: searchParams.get('q') ?? '',
    onTermChange: (term) => update({ q: term }),
  });

  const [filtersOpen, setFiltersOpen] = useState(
    status.length > 0 || Boolean(responsibleId || registered),
  );

  const range = useMemo(() => {
    if (registered === 'custom') {
      return { from: registeredFromParam, to: registeredToParam };
    }

    const days = RANGE_DAYS[registered];

    if (!days) {
      return { from: '', to: '' };
    }

    const from = new Date();
    from.setDate(from.getDate() - days);

    return { from: isoDate(from), to: '' };
  }, [registered, registeredFromParam, registeredToParam]);

  const hasFilters = status.length > 0 || Boolean(responsibleId || registered);

  const [retryKey, setRetryKey] = useState(0);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [success, setSuccess] = useState('');
  const key = [
    search.term,
    status.join(','),
    responsibleId,
    range.from,
    range.to,
    sort,
    order,
    page,
    limit,
    retryKey,
    reloadKey,
  ].join('\n');
  const [last, setLast] = useState<{
    key: string;
    response: PatientsListResponse;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    error: unknown;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getPatients({
      page,
      limit,
      q: search.term,
      status,
      responsibleProfessionalId: responsibleId,
      registeredFrom: range.from,
      registeredTo: range.to,
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

  const loading = last?.key !== key;
  const total = last?.response.pagination.total ?? 0;
  const filtered = Boolean(search.term) || hasFilters;
  const count = last
    ? `${total} ${total === 1 ? 'paciente' : 'pacientes'}${filtered ? ' com os filtros atuais' : ''}`
    : 'Carregando...';

  function clearFilters() {
    update({
      status: '',
      responsible: '',
      registered: '',
      registeredFrom: '',
      registeredTo: '',
    });
  }

  function handleDeleted(_id: string, name: string) {
    setDeleting(null);
    setSuccess(`Paciente ${name} excluído`);
    setRetryKey((current) => current + 1);
  }

  return (
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

      <div className="ux-tcard" aria-busy={loading}>
        <div className="ux-tcard-head">
          <div>
            <h2>
              {isAdmin ? 'Pacientes cadastrados' : 'Pacientes vinculados'}
            </h2>
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
                placeholder="Nome, nome social, e-mail, CNS ou CPF"
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
              aria-controls="patients-more"
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

            <label className="ux-sort" htmlFor="patients-sort">
              <span>Ordenar por</span>
              <select
                className="select"
                id="patients-sort"
                value={sort}
                onChange={(event) =>
                  update({
                    sort:
                      event.target.value === 'registeredAt'
                        ? 'registeredAt'
                        : '',
                  })
                }
              >
                <option value="name">Nome</option>
                <option value="registeredAt">Data de cadastro</option>
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

        <div className="filter-more" id="patients-more" hidden={!filtersOpen}>
          <MultiSelect
            label="Status do PTS"
            options={statusOptions(isAdmin)}
            value={status}
            onChange={(value) => update({ status: value.join(',') })}
          />

          <ResponsibleFilter
            value={responsibleId}
            onChange={(id) => update({ responsible: id })}
          />

          <div className="field">
            <label className="field-label" htmlFor="patients-registered">
              Data de cadastro
            </label>
            <select
              className="select"
              id="patients-registered"
              value={registered}
              onChange={(event) =>
                update({
                  registered: event.target.value,
                  registeredFrom: '',
                  registeredTo: '',
                })
              }
            >
              <option value="">Qualquer data</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="custom">Personalizado</option>
            </select>

            {registered === 'custom' && (
              <div className="range-custom">
                <input
                  className="input"
                  type="date"
                  aria-label="De"
                  value={registeredFromParam}
                  onChange={(event) =>
                    update({ registeredFrom: event.target.value })
                  }
                />
                <input
                  className="input"
                  type="date"
                  aria-label="Até"
                  value={registeredToParam}
                  onChange={(event) =>
                    update({ registeredTo: event.target.value })
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
            <h2>Não foi possível carregar os pacientes</h2>
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
            <p>Carregando pacientes...</p>
          </div>
        ) : last.response.data.length === 0 ? (
          <div className={ui.empty}>
            <div className={ui.emptyIcon}>
              <Icon name={filtered ? 'search' : 'patient'} />
            </div>
            {filtered ? (
              <>
                <h2>Nenhum paciente encontrado</h2>
                <p>Revise a busca ou os filtros.</p>
              </>
            ) : isAdmin ? (
              <>
                <h2>Nenhum paciente cadastrado</h2>
                <p>Os pacientes adicionados aparecem aqui.</p>
              </>
            ) : (
              <>
                <h2>Nenhum paciente vinculado</h2>
                <p>Os pacientes dos PTS em que você atua aparecem aqui.</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className={`table-wrap ${loading ? styles.refreshing : ''}`}>
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Paciente</th>
                    <th scope="col">E-mail</th>
                    <th scope="col">CNS</th>
                    <th scope="col">Responsável tutelar</th>
                    <th scope="col">Status do PTS</th>
                    <th scope="col">Cadastrado em</th>
                    <th scope="col" className="actions-col">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {last.response.data.map((patient) => (
                    <tr key={patient.id}>
                      <td>
                        <div className="person">
                          <span className="avatar" aria-hidden="true">
                            {initial(patient.name)}
                          </span>
                          <div>
                            <strong>{patient.name}</strong>
                          </div>
                        </div>
                      </td>
                      <td>{patient.email}</td>
                      <td className="num">
                        {patient.cns ? formatCns(patient.cns) : <EmptyCell />}
                      </td>
                      <td>{patient.guardianName ?? <EmptyCell />}</td>
                      <td className="nowrap">
                        <PtsStatusBadge status={patient.ptsStatus} />
                      </td>
                      <td className="num">
                        {formatDate(patient.registeredAt)}
                      </td>
                      <td className="actions-col">
                        <KebabMenu label={`Ações para ${patient.name}`}>
                          <li>
                            <Link
                              role="menuitem"
                              href={`/patients/${patient.id}`}
                            >
                              <Icon name="eye" className="icon-sm" />
                              Visualizar
                            </Link>
                          </li>
                          {patient.activePtsId && (
                            <li>
                              <Link
                                role="menuitem"
                                href={`/pts/${patient.activePtsId}`}
                              >
                                <Icon name="pts" className="icon-sm" />
                                Abrir PTS
                              </Link>
                            </li>
                          )}
                          {isAdmin && (
                            <li>
                              <div className="sep" />
                              <button
                                type="button"
                                role="menuitem"
                                className="danger"
                                onClick={() =>
                                  setDeleting({
                                    id: patient.id,
                                    name: patient.name,
                                  })
                                }
                              >
                                <Icon name="trash" className="icon-sm" />
                                Excluir
                              </button>
                            </li>
                          )}
                        </KebabMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              label="Paginação de pacientes"
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

      <DeletePatientDialog
        patient={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={handleDeleted}
      />
    </>
  );
}

type ResponsibleFilterProps = {
  value: string;
  onChange: (id: string) => void;
};

// Profissional responsável: autocomplete por nome (RFPRO001); a URL guarda o
// id, e o nome é buscado de novo ao recarregar.
function ResponsibleFilter({ value, onChange }: ResponsibleFilterProps) {
  const [text, setText] = useState('');
  const [options, setOptions] = useState<Professional[]>([]);

  useEffect(() => {
    if (!value) {
      return;
    }

    let active = true;

    getProfessionals({ page: 1, limit: 1, ids: [value] })
      .then((response) => {
        if (active && response.data[0]) {
          setText(response.data[0].name);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [value]);

  useEffect(() => {
    const term = text.trim();

    if (term.length < 2) {
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      getProfessionals({ page: 1, limit: 10, name: term })
        .then((response) => {
          if (active) {
            setOptions(response.data);
          }
        })
        .catch(() => undefined);
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [text]);

  function handleChange(next: string) {
    setText(next);
    const match = options.find((option) => option.name === next);

    if (match) {
      onChange(match.id);
    } else if (!next.trim() && value) {
      onChange('');
    }
  }

  return (
    <label className="field">
      <span>Profissional responsável</span>
      <input
        className="input"
        list="patients-responsible-list"
        placeholder="Nome ou e-mail"
        autoComplete="off"
        value={text}
        onChange={(event) => handleChange(event.target.value)}
      />
      <datalist id="patients-responsible-list">
        {options.map((option) => (
          <option key={option.id} value={option.name} />
        ))}
      </datalist>
    </label>
  );
}
