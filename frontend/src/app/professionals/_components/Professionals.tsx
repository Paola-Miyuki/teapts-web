'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import KebabMenu from '@/components/table/KebabMenu';
import MultiSelect from '@/components/table/MultiSelect';
import Pagination, { PER_PAGE_OPTIONS } from '@/components/table/Pagination';
import ui from '@/components/ui.module.css';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { ApiError } from '@/lib/api';
import {
  formatRegistration,
  getProfessionals,
  type Professional,
  type ProfessionalSpecialism,
  type ProfessionalsResponse,
} from '@/lib/professionals';
import LoadingState from './LoadingState';

const SPECIALISMS: { value: ProfessionalSpecialism; label: string }[] = [
  { value: 'doctor', label: 'Medicina' },
  { value: 'physiotherapist', label: 'Fisioterapia' },
  { value: 'psychologist', label: 'Psicologia' },
];

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

// Registro com o botão de copiar, como em `profissionais.html`.
function RegistrationCell({ professional }: { professional: Professional }) {
  const [copied, setCopied] = useState(false);

  if (!professional.registration) {
    return <EmptyCell />;
  }

  const label = formatRegistration(professional.registration);

  return (
    <span className="copy-cell">
      {label}
      <button
        type="button"
        className="copy-btn"
        aria-label={copied ? 'Registro copiado' : `Copiar Registro ${label}`}
        title={copied ? 'Registro copiado.' : undefined}
        onClick={() => {
          void navigator.clipboard
            ?.writeText(label)
            .then(() => setCopied(true));
        }}
      >
        <Icon name={copied ? 'check' : 'copy'} className="icon-sm" />
      </button>
    </span>
  );
}

// "Visualizar" do admin: perfil profissional e conta. Telefone, PTS ativos,
// editar e desativar entram com a #54, a #55 e a #108.
function ProfessionalViewDialog({
  professional,
  onClose,
}: {
  professional: Professional | null;
  onClose: () => void;
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
        <button type="button" className="btn" onClick={onClose}>
          Fechar
        </button>
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
              {item('UF do registro', professional.registration?.state)}
              {item('Instituição', professional.institution)}
              {item('CNES', professional.cnes)}
              {item(
                'Situação da conta',
                <span className="badge active">Ativo</span>,
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
// DP011). Situação e ações só para o admin; a situação é "Ativo" até existir
// conta inativa (#108). A API filtra uma especialidade por vez.
export default function Professionals({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const search = useDebouncedSearch();
  const [specialism, setSpecialism] = useState<ProfessionalSpecialism | ''>('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PER_PAGE_OPTIONS[0]);
  const [retryKey, setRetryKey] = useState(0);
  const [result, setResult] = useState<ProfessionalsResponse | null>(null);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<Professional | null>(null);

  const term = search.term;
  const [lastQuery, setLastQuery] = useState({ term, specialism });

  // Busca ou filtro novos voltam à página 1.
  if (lastQuery.term !== term || lastQuery.specialism !== specialism) {
    setLastQuery({ term, specialism });
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;

    getProfessionals({
      page,
      limit,
      name: term,
      specialism: specialism || undefined,
    })
      .then((response) => {
        if (!cancelled) {
          setError('');
          setResult(response);
        }
      })
      .catch((reason: unknown) => {
        if (cancelled) {
          return;
        }

        if (reason instanceof ApiError && reason.status === 401) {
          router.replace('/login');
          return;
        }

        setError('Não foi possível consultar os profissionais.');
      });

    return () => {
      cancelled = true;
    };
  }, [limit, page, retryKey, router, specialism, term]);

  const filtered = Boolean(term || specialism);
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
              placeholder="Nome do profissional"
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

          {specialism && (
            <button
              type="button"
              className="btn"
              onClick={() => setSpecialism('')}
            >
              <Icon name="close" className="icon-sm" />
              Limpar
            </button>
          )}
        </div>
      </div>

      <div
        className="filter-more"
        id="professionals-more"
        hidden={!filtersOpen}
      >
        <MultiSelect
          label="Especialidade"
          placeholder="Todas as especialidades"
          options={SPECIALISMS}
          value={specialism ? [specialism] : []}
          onChange={(value) =>
            setSpecialism(
              (value.filter((item) => item !== specialism)[0] ?? '') as
                ProfessionalSpecialism | '',
            )
          }
        />
      </div>

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
                      <RegistrationCell professional={professional} />
                    </td>
                    <td>{professional.email ?? <EmptyCell />}</td>
                    <td className="ux-col-lg">
                      {professional.institution ?? <EmptyCell />}
                    </td>
                    {isAdmin && (
                      <>
                        <td>
                          <span className="badge active">Ativo</span>
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
        onClose={() => setViewing(null)}
      />
    </div>
  );
}
