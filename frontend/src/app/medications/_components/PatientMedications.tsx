'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import KebabMenu from '@/components/table/KebabMenu';
import MultiSelect from '@/components/table/MultiSelect';
import Pagination from '@/components/table/Pagination';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { formatDateOnly } from '@/lib/format';
import { getMedications, type Medication } from '@/lib/patients';
import styles from '../../patients/patients.module.css';

const LOAD_ERROR = 'Não foi possível carregar as medicações';

type Situation = 'using' | 'stopped';
type SortField = 'startDate' | 'drugName';
type Order = 'asc' | 'desc';

const SITUATIONS = [
  { value: 'using', label: 'Em uso' },
  { value: 'stopped', label: 'Suspensa' },
];

function EmptyCell() {
  return (
    <span className="empty-cell" aria-label="Não informado">
      —
    </span>
  );
}

function SituationBadge({ medication }: { medication: Medication }) {
  return medication.endDate ? (
    <span className="badge inactive">Suspensa</span>
  ) : (
    <span className="badge active">Em uso</span>
  );
}

// Texto sem acento e em minúsculas, para a busca por nome do medicamento.
function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// `AAAA-MM-DD` de N dias atrás, para o filtro de período pela data de início.
function daysAgo(days: number) {
  const date = new Date();

  date.setDate(date.getDate() - days);

  return date.toISOString().slice(0, 10);
}

// "Minhas medicações" de `minhas-medicacoes.html` (RFPAC007): o paciente só
// consulta; a busca, os filtros, a ordem e a paginação são feitos aqui, porque
// a API devolve a lista inteira.
export default function PatientMedications({
  patientId,
}: {
  patientId: string;
}) {
  const router = useRouter();

  const [medications, setMedications] = useState<Medication[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const [search, setSearch] = useState('');
  const [situations, setSituations] = useState<string[]>([]);
  const [period, setPeriod] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<SortField>('startDate');
  const [order, setOrder] = useState<Order>('desc');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [viewing, setViewing] = useState<Medication | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getMedications(patientId, controller.signal)
      .then((response) => {
        setMedications(response.data);
        setLoadError('');
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (reason instanceof ApiError && reason.status === 401) {
          router.replace('/login');
          return;
        }

        setLoadError(
          reason instanceof ApiError && reason.apiMessage
            ? reason.apiMessage
            : LOAD_ERROR,
        );
      });

    return () => controller.abort();
  }, [patientId, retryKey, router]);

  const hasFilters =
    search.trim() !== '' || situations.length > 0 || period !== '';

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    const since =
      period === '30' || period === '90' ? daysAgo(Number(period)) : '';

    return (medications ?? [])
      .filter((medication) => {
        if (term && !normalize(medication.drugName).includes(term)) {
          return false;
        }

        const situation: Situation = medication.endDate ? 'stopped' : 'using';

        if (situations.length > 0 && !situations.includes(situation)) {
          return false;
        }

        if (since && medication.startDate < since) {
          return false;
        }

        if (period === 'custom') {
          if (from && medication.startDate < from) {
            return false;
          }

          if (to && medication.startDate > to) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const result =
          sort === 'drugName'
            ? a.drugName.localeCompare(b.drugName, 'pt-BR')
            : a.startDate.localeCompare(b.startDate);

        return order === 'asc' ? result : -result;
      });
  }, [medications, search, situations, period, from, to, sort, order]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * limit, currentPage * limit);
  const count =
    medications === null
      ? ''
      : `${medications.length} ${medications.length === 1 ? 'medicação' : 'medicações'}`;

  function clearFilters() {
    setSearch('');
    setSituations([]);
    setPeriod('');
    setFrom('');
    setTo('');
    setPage(1);
  }

  return (
    <div className="ux-tcard" aria-busy={medications === null && !loadError}>
      <div className="ux-tcard-head">
        <div>
          <h2>Minhas medicações</h2>
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
              placeholder="Nome do medicamento"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </span>
        </label>

        <div className="ux-tools">
          <button
            type="button"
            className="btn filter-toggle"
            aria-expanded={filtersOpen}
            aria-controls="medications-more"
            onClick={() => setFiltersOpen((current) => !current)}
          >
            <Icon name="filter" className="icon-sm" />
            Filtros
          </button>

          <button type="button" className="btn" onClick={clearFilters}>
            <Icon name="close" className="icon-sm" />
            Limpar
          </button>

          <label className="ux-sort" htmlFor="medications-sort">
            <span>Ordenar por</span>
            <select
              className="select"
              id="medications-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortField)}
            >
              <option value="startDate">Data de início</option>
              <option value="drugName">Medicamento</option>
            </select>
            <button
              type="button"
              className="btn btn-sm sort-dir"
              data-dir={order}
              aria-label={
                order === 'asc' ? 'Ordem crescente' : 'Ordem decrescente'
              }
              onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}
            >
              <Icon
                name={order === 'asc' ? 'sortUp' : 'sortDown'}
                className="icon-sm"
              />
            </button>
          </label>
        </div>
      </div>

      <div className="filter-more" id="medications-more" hidden={!filtersOpen}>
        <MultiSelect
          label="Situação"
          placeholder="Todas"
          options={SITUATIONS}
          value={situations}
          onChange={(value) => {
            setSituations(value);
            setPage(1);
          }}
        />

        <div className="field">
          <label className="field-label" htmlFor="medications-period">
            Período
          </label>
          <select
            className="select"
            id="medications-period"
            value={period}
            onChange={(event) => {
              setPeriod(event.target.value);
              setFrom('');
              setTo('');
              setPage(1);
            }}
          >
            <option value="">Qualquer período</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="custom">Personalizado</option>
          </select>

          {period === 'custom' && (
            <div className="range-custom">
              <input
                className="input"
                type="date"
                aria-label="De"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setPage(1);
                }}
              />
              <input
                className="input"
                type="date"
                aria-label="Até"
                value={to}
                onChange={(event) => {
                  setTo(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {loadError ? (
        <div className={ui.empty} role="alert">
          <div className={ui.emptyIcon}>
            <Icon name="alertCircle" />
          </div>
          <h2>Não foi possível carregar as medicações</h2>
          <p>{loadError}</p>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnSecondary}`}
            onClick={() => {
              setMedications(null);
              setLoadError('');
              setRetryKey((current) => current + 1);
            }}
          >
            Tentar novamente
          </button>
        </div>
      ) : medications === null ? (
        <div className={ui.empty} role="status" aria-live="polite">
          <div className={styles.loader} />
          <p>Carregando medicações...</p>
        </div>
      ) : total === 0 ? (
        <div className={ui.empty}>
          <div className={ui.emptyIcon}>
            <Icon name="search" />
          </div>
          <h2>Nenhuma medicação encontrada</h2>
          <p>
            {hasFilters
              ? 'Revise a busca ou limpe os filtros.'
              : 'Ainda não há medicações registradas.'}
          </p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Medicamento</th>
                  <th scope="col">Dose</th>
                  <th scope="col">Frequência</th>
                  <th scope="col">Prescritor</th>
                  <th scope="col">Início</th>
                  <th scope="col">Fim</th>
                  <th scope="col">Situação</th>
                  <th scope="col" className="actions-col">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((medication) => (
                  <tr key={medication.id}>
                    <td>
                      <strong>{medication.drugName}</strong>
                    </td>
                    <td>{medication.dose}</td>
                    <td>{medication.frequency}</td>
                    <td>{medication.prescriber ?? <EmptyCell />}</td>
                    <td className="num">
                      {formatDateOnly(medication.startDate)}
                    </td>
                    <td className="num">
                      {medication.endDate ? (
                        formatDateOnly(medication.endDate)
                      ) : (
                        <EmptyCell />
                      )}
                    </td>
                    <td>
                      <SituationBadge medication={medication} />
                    </td>
                    <td className="actions-col">
                      <KebabMenu label={`Ações para ${medication.drugName}`}>
                        <li>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => setViewing(medication)}
                          >
                            <Icon name="eye" className="icon-sm" />
                            Visualizar
                          </button>
                        </li>
                      </KebabMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={currentPage}
            limit={limit}
            total={total}
            totalPages={totalPages}
            label="Paginação"
            onPageChange={setPage}
            onLimitChange={(value) => {
              setLimit(value);
              setPage(1);
            }}
          />
        </>
      )}

      <Modal
        open={viewing !== null}
        id="medication-view"
        title={viewing?.drugName ?? ''}
        size="sm"
        onClose={() => setViewing(null)}
        footer={
          <button
            type="button"
            className="btn"
            onClick={() => setViewing(null)}
          >
            Fechar
          </button>
        }
      >
        {viewing && (
          <dl className="data-grid">
            <div>
              <dt>Dose</dt>
              <dd>{viewing.dose}</dd>
            </div>
            <div>
              <dt>Frequência</dt>
              <dd>{viewing.frequency}</dd>
            </div>
            <div>
              <dt>Prescritor</dt>
              <dd>{viewing.prescriber ?? <EmptyCell />}</dd>
            </div>
            <div>
              <dt>Motivo</dt>
              <dd>{viewing.reason ?? <EmptyCell />}</dd>
            </div>
            <div>
              <dt>Início</dt>
              <dd>{formatDateOnly(viewing.startDate)}</dd>
            </div>
            <div>
              <dt>Fim</dt>
              <dd>
                {viewing.endDate ? (
                  formatDateOnly(viewing.endDate)
                ) : (
                  <EmptyCell />
                )}
              </dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>
                <SituationBadge medication={viewing} />
              </dd>
            </div>
          </dl>
        )}
      </Modal>
    </div>
  );
}
