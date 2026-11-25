'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import KebabMenu from '@/components/table/KebabMenu';
import RegistrationCell from '@/components/table/RegistrationCell';
import MultiSelect from '@/components/table/MultiSelect';
import Pagination, { PER_PAGE_OPTIONS } from '@/components/table/Pagination';
import ui from '@/components/ui.module.css';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { ApiError } from '@/lib/api';
import {
  COUNCIL_STATES,
  COUNCILS,
  getProfessionals,
  SPECIALISMS,
  type Professional,
  type ProfessionalCouncil,
  type ProfessionalSort,
  type ProfessionalStatus,
  type ProfessionalSpecialism,
  type ProfessionalsResponse,
  type UpdatedProfessional,
} from '@/lib/professionals';
import DeactivateProfessionalDialog from './DeactivateProfessionalDialog';
import EditSpecialismDialog from './EditSpecialismDialog';
import LoadingState from './LoadingState';

const SPECIALISM_OPTIONS = SPECIALISMS.map(({ value, label }) => ({
  value,
  label,
}));

const STATUSES: { value: ProfessionalStatus; label: string }[] = [
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
];

function StatusBadge({ status }: { status: ProfessionalStatus }) {
  return (
    <span className={`badge ${status}`}>
      {status === 'inactive' ? 'Inativo' : 'Ativo'}
    </span>
  );
}

const COUNCIL_OPTIONS = COUNCILS.map((value) => ({ value, label: value }));

function listParam<T extends string>(
  raw: string | null,
  options: { value: T }[],
): T[] {
  const values = (raw ?? '').split(',');

  return options
    .map((option) => option.value)
    .filter((v) => values.includes(v));
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

// "Desativar" só para conta ativa com `accountId` (só o admin recebe).
function canDeactivate(professional: Professional) {
  return professional.status === 'active' && Boolean(professional.accountId);
}

function blockedNote(name: string) {
  return `Desativar fica bloqueado: ${name} é responsável por PTS ativo. Transfira a responsabilidade antes`;
}

// "Visualizar" do admin: perfil profissional e conta, com "Editar
// especialidade" e "Desativar". Telefone e PTS ativos entram com a #108.
function ProfessionalViewDialog({
  professional,
  blocked,
  onClose,
  onEdit,
  onDeactivate,
}: {
  professional: Professional | null;
  blocked: boolean;
  onClose: () => void;
  onEdit: (professional: Professional) => void;
  onDeactivate: (professional: Professional) => void;
}) {
  const item = (label: string, value: ReactNode) => (
    <div>
      <dt>{label}</dt>
      <dd>{value || <EmptyCell />}</dd>
    </div>
  );

  return (
    <Modal
      open={professional !== null}
      id="professional-view"
      title={professional?.name ?? ''}
      onClose={onClose}
      footer={
        <>
          {professional && canDeactivate(professional) && (
            <>
              {blocked ? (
                <span className="muted spacer" style={{ fontSize: 12 }}>
                  Desativar bloqueado: é responsável por PTS ativo.
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn-danger spacer"
                  onClick={() => onDeactivate(professional)}
                >
                  <Icon name="lock" className="icon-sm" />
                  Desativar
                </button>
              )}
            </>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Fechar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => professional && onEdit(professional)}
          >
            <Icon name="edit" className="icon-sm" />
            Editar especialidade
          </button>
        </>
      }
    >
      {professional && (
        <>
          <section>
            <h3>Perfil profissional</h3>
            <dl className="data-grid">
              {item('Profissão', professional.specialism.name)}
              {item('Conselho regional', professional.registration?.council)}
              {item('Nº de registro', professional.registration?.number)}
              {item(
                'UF do registro',
                professional.registration?.state.toUpperCase(),
              )}
              {item('Instituição', professional.institution)}
              {item('CNES', professional.cnes)}
              {item(
                'Situação da conta',
                <StatusBadge status={professional.status} />,
              )}
            </dl>
          </section>
          <section>
            <h3>Conta</h3>
            <dl className="data-grid">{item('E-mail', professional.email)}</dl>
          </section>
        </>
      )}
    </Modal>
  );
}

// Lista de `profissionais.html` (o e-mail só vem para admin e profissional,
// DP011). Busca, filtros e ordenação ficam na URL (`q`, `specialism`,
// `council`, `uf`, `sort`, `order`). Situação e ações só para o admin; a
// situação vem da conta (RFAUT005): o profissional só recebe os ativos.
export default function Professionals({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const specialism = listParam(
    searchParams.get('specialism'),
    SPECIALISM_OPTIONS,
  );
  const council = listParam(searchParams.get('council'), COUNCIL_OPTIONS);
  // A situação é filtro do admin; para os demais, a URL é ignorada.
  const status = isAdmin ? listParam(searchParams.get('status'), STATUSES) : [];
  const ufParam = searchParams.get('uf') ?? '';
  const uf = COUNCIL_STATES.some((item) => item === ufParam) ? ufParam : '';
  const sort: ProfessionalSort =
    searchParams.get('sort') === 'specialism' ? 'specialism' : 'name';
  const order = searchParams.get('order') === 'desc' ? 'desc' : 'asc';

  function update(changes: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    const query = params.toString();
    router.replace(query ? `/professionals?${query}` : '/professionals', {
      scroll: false,
    });
  }

  const search = useDebouncedSearch({
    initialTerm: searchParams.get('q') ?? '',
    onTermChange: (value) => update({ q: value }),
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PER_PAGE_OPTIONS[0]);
  const [retryKey, setRetryKey] = useState(0);
  const [result, setResult] = useState<ProfessionalsResponse | null>(null);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<Professional | null>(null);
  const [editing, setEditing] = useState<Professional | null>(null);
  const [deactivating, setDeactivating] = useState<Professional | null>(null);
  // Aviso de sucesso da última ação (editar ou desativar).
  const [notice, setNotice] = useState('');
  // Perfis que a API recusou desativar por serem responsáveis por PTS ativo.
  const [blockedIds, setBlockedIds] = useState<string[]>([]);

  const term = search.term;
  const specialismKey = specialism.join(',');
  const councilKey = council.join(',');
  const statusKey = status.join(',');
  const queryKey = [
    term,
    specialismKey,
    councilKey,
    uf,
    statusKey,
    sort,
    order,
  ].join('\n');
  const [lastQuery, setLastQuery] = useState(queryKey);

  // Busca, filtro ou ordenação novos voltam à página 1.
  if (lastQuery !== queryKey) {
    setLastQuery(queryKey);
    setPage(1);
  }

  useEffect(() => {
    const controller = new AbortController();

    getProfessionals(
      {
        page,
        limit,
        q: term,
        specialism: specialismKey
          ? (specialismKey.split(',') as ProfessionalSpecialism[])
          : undefined,
        council: councilKey
          ? (councilKey.split(',') as ProfessionalCouncil[])
          : undefined,
        councilState: uf || undefined,
        status: statusKey
          ? (statusKey.split(',') as ProfessionalStatus[])
          : undefined,
        sort: sort === 'specialism' ? sort : undefined,
        order: order === 'desc' ? order : undefined,
      },
      controller.signal,
    )
      .then((response) => {
        setError('');
        setResult(response);
      })
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
            : 'Não foi possível consultar os profissionais',
        );
      });

    return () => controller.abort();
  }, [
    councilKey,
    limit,
    order,
    page,
    retryKey,
    router,
    sort,
    specialismKey,
    statusKey,
    term,
    uf,
  ]);

  // Troca a profissão e o registro da linha sem recarregar a lista.
  function handleSaved(updated: UpdatedProfessional) {
    setResult((current) =>
      current
        ? {
            ...current,
            data: current.data.map((item) =>
              item.id === updated.id
                ? {
                    ...item,
                    specialism: updated.specialism,
                    registration: updated.registration,
                  }
                : item,
            ),
          }
        : current,
    );
    setEditing(null);
    setNotice('Especialidade atualizada');
  }

  // A linha passa para "Inativo" sem recarregar a lista.
  function handleDeactivated(professional: Professional) {
    setResult((current) =>
      current
        ? {
            ...current,
            data: current.data.map((item) =>
              item.id === professional.id
                ? { ...item, status: 'inactive' as const }
                : item,
            ),
          }
        : current,
    );
    setDeactivating(null);
    setNotice('Profissional desativado');
  }

  const hasFilters = Boolean(specialismKey || councilKey || uf || statusKey);
  const filtered = Boolean(term || hasFilters);

  function clearFilters() {
    update({ specialism: '', council: '', uf: '', status: '' });
  }
  const total = result?.pagination.total ?? 0;
  const count = result
    ? `${total} ${total === 1 ? 'profissional' : 'profissionais'}${filtered ? ' com os filtros atuais' : ''}`
    : 'Carregando...';

  return (
    <div className="ux-tcard">
      <div className="ux-tcard-head">
        <div>
          <h2>Profissionais cadastrados</h2>
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
              placeholder="Nome, e-mail ou nº de registro"
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
            aria-controls="professionals-more"
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

          <label className="ux-sort" htmlFor="professionals-sort">
            <span>Ordenar por</span>
            <select
              className="select"
              id="professionals-sort"
              value={sort}
              onChange={(event) =>
                update({
                  sort: event.target.value === 'specialism' ? 'specialism' : '',
                })
              }
            >
              <option value="name">Nome</option>
              <option value="specialism">Profissão</option>
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

      <div
        className="filter-more"
        id="professionals-more"
        hidden={!filtersOpen}
      >
        {isAdmin && (
          <MultiSelect
            label="Situação"
            placeholder="Todos"
            options={STATUSES}
            value={status}
            onChange={(value) => update({ status: value.join(',') })}
          />
        )}

        <MultiSelect
          label="Profissão"
          placeholder="Todas as profissões"
          options={SPECIALISM_OPTIONS}
          value={specialism}
          onChange={(value) => update({ specialism: value.join(',') })}
        />

        <MultiSelect
          label="Conselho regional"
          options={COUNCIL_OPTIONS}
          value={council}
          onChange={(value) => update({ council: value.join(',') })}
        />

        <label className="field">
          <span>UF do registro</span>
          <select
            className="select"
            value={uf}
            onChange={(event) => update({ uf: event.target.value })}
          >
            <option value="">Todas</option>
            {COUNCIL_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>
      </div>

      {notice && (
        <div className={`${ui.alert} ${ui.alertSuccess}`} role="status">
          <div className={ui.alertIcon}>
            <Icon name="checkCircle" />
          </div>
          <span>{notice}</span>
        </div>
      )}

      {error ? (
        <div className={ui.empty} role="alert">
          <h2>Não foi possível carregar os profissionais</h2>
          <p>{error}</p>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnSecondary}`}
            onClick={() => setRetryKey((current) => current + 1)}
          >
            Tentar novamente
          </button>
        </div>
      ) : !result ? (
        <LoadingState />
      ) : result.data.length === 0 ? (
        <div className={ui.empty}>
          <div className={ui.emptyIcon}>
            <Icon name={filtered ? 'search' : 'people'} />
          </div>
          <h2>
            {filtered
              ? 'Nenhum profissional encontrado'
              : 'Nenhum profissional cadastrado'}
          </h2>
          <p>
            {filtered
              ? 'Revise a busca ou os filtros.'
              : 'Os profissionais cadastrados aparecem aqui.'}
          </p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Profissional</th>
                  <th scope="col">Profissão</th>
                  <th scope="col">Registro</th>
                  <th scope="col">E-mail</th>
                  <th scope="col">Instituição</th>
                  {isAdmin && (
                    <>
                      <th scope="col">Situação</th>
                      <th scope="col" className="actions-col">
                        <span className="sr-only">Ações</span>
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {result.data.map((professional) => (
                  <tr key={professional.id}>
                    <td>
                      <div className="person">
                        <span className="avatar" aria-hidden="true">
                          {initial(professional.name)}
                        </span>
                        <div>
                          <strong>{professional.name}</strong>
                        </div>
                      </div>
                    </td>
                    <td>{professional.specialism.name}</td>
                    <td className="nowrap">
                      <RegistrationCell
                        registration={professional.registration}
                      />
                    </td>
                    <td>{professional.email ?? <EmptyCell />}</td>
                    <td className="ux-col-lg">
                      {professional.institution ?? <EmptyCell />}
                    </td>
                    {isAdmin && (
                      <>
                        <td>
                          <StatusBadge status={professional.status} />
                        </td>
                        <td className="actions-col">
                          <KebabMenu label={`Ações para ${professional.name}`}>
                            <li>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => setViewing(professional)}
                              >
                                <Icon name="eye" className="icon-sm" />
                                Visualizar
                              </button>
                            </li>
                            <li>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setNotice('');
                                  setEditing(professional);
                                }}
                              >
                                <Icon name="edit" className="icon-sm" />
                                Editar especialidade
                              </button>
                            </li>
                            {canDeactivate(professional) && (
                              <li>
                                {blockedIds.includes(professional.id) ? (
                                  <p className="note">
                                    {blockedNote(professional.name)}
                                  </p>
                                ) : (
                                  <>
                                    <div className="sep" />
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="danger"
                                      onClick={() => {
                                        setNotice('');
                                        setDeactivating(professional);
                                      }}
                                    >
                                      <Icon name="lock" className="icon-sm" />
                                      Desativar
                                    </button>
                                  </>
                                )}
                              </li>
                            )}
                          </KebabMenu>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            label="Paginação de profissionais"
            page={result.pagination.page}
            limit={limit}
            total={result.pagination.total}
            totalPages={result.pagination.totalPages}
            onPageChange={setPage}
            onLimitChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
          />
        </>
      )}

      <ProfessionalViewDialog
        professional={viewing}
        blocked={viewing ? blockedIds.includes(viewing.id) : false}
        onClose={() => setViewing(null)}
        onEdit={(professional) => {
          setViewing(null);
          setNotice('');
          setEditing(professional);
        }}
        onDeactivate={(professional) => {
          setViewing(null);
          setNotice('');
          setDeactivating(professional);
        }}
      />

      <DeactivateProfessionalDialog
        professional={deactivating}
        onClose={() => setDeactivating(null)}
        onDeactivated={handleDeactivated}
        onBlocked={(professional) =>
          setBlockedIds((current) => [...current, professional.id])
        }
        onUnauthorized={() => router.replace('/login')}
      />

      <EditSpecialismDialog
        professional={editing}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
        onUnauthorized={() => router.replace('/login')}
      />
    </div>
  );
}
