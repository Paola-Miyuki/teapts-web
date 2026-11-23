'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import MultiSelect from '@/components/table/MultiSelect';
import Pagination, { PER_PAGE_OPTIONS } from '@/components/table/Pagination';
import ui from '@/components/ui.module.css';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { ApiError } from '@/lib/api';
import {
  getProfessionals,
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

// Lista de `profissionais.html`, com as colunas que a API já devolve: nome,
// profissão e e-mail (o e-mail só vem para admin e profissional, DP011).
// A API filtra uma especialidade por vez.
export default function Professionals() {
  const router = useRouter();
  const search = useDebouncedSearch();
  const [specialism, setSpecialism] = useState<ProfessionalSpecialism | ''>('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PER_PAGE_OPTIONS[0]);
  const [retryKey, setRetryKey] = useState(0);
  const [result, setResult] = useState<ProfessionalsResponse | null>(null);
  const [error, setError] = useState('');

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
                  <th scope="col">E-mail</th>
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
                    <td>
                      {professional.email ?? (
                        <span className="empty-cell" aria-label="Não informado">
                          —
                        </span>
                      )}
                    </td>
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
    </div>
  );
}
