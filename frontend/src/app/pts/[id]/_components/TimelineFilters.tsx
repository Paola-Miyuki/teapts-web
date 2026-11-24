'use client';

import { useEffect, useState } from 'react';

import Icon from '@/components/Icon';
import MultiSelect from '@/components/table/MultiSelect';
import { getProfessionals } from '@/lib/professionals';
import {
  TIMELINE_TYPE_LABELS,
  type TimelineOrder,
  type TimelinePerson,
  type TimelineTargetType,
} from '@/lib/timeline';

export type TimelinePeriod = '' | '30' | '90' | 'custom';

export type TimelineFilterValue = {
  types: TimelineTargetType[];
  authorId: string;
  period: TimelinePeriod;
  from: string;
  to: string;
};

export const EMPTY_TIMELINE_FILTERS: TimelineFilterValue = {
  types: [],
  authorId: '',
  period: '',
  from: '',
  to: '',
};

const TYPE_OPTIONS = (
  Object.entries(TIMELINE_TYPE_LABELS) as [TimelineTargetType, string][]
).map(([value, label]) => ({ value, label }));

function isoDay(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

export function periodRange(
  value: Pick<TimelineFilterValue, 'period' | 'from' | 'to'>,
  today = new Date(),
): { from: string; to: string } {
  if (value.period === 'custom') {
    return { from: value.from, to: value.to };
  }

  if (value.period === '30' || value.period === '90') {
    const from = new Date(today);
    from.setDate(from.getDate() - Number(value.period));

    return { from: isoDay(from), to: '' };
  }

  return { from: '', to: '' };
}

export function hasTimelineFilters(value: TimelineFilterValue) {
  return (
    value.types.length > 0 || Boolean(value.authorId) || Boolean(value.period)
  );
}

export type TimelineSearch = {
  input: string;
  setInput: (value: string) => void;
  commit: () => void;
  clear: () => void;
};

type TimelineFiltersProps = {
  search: TimelineSearch;
  value: TimelineFilterValue;
  onChange: (value: TimelineFilterValue) => void;
  order: TimelineOrder;
  onOrderChange: (order: TimelineOrder) => void;
  searchProfessionals: boolean;
  team: TimelinePerson[];
};

export default function TimelineFilters({
  search,
  value,
  onChange,
  order,
  onOrderChange,
  searchProfessionals,
  team,
}: TimelineFiltersProps) {
  const [open, setOpen] = useState(hasTimelineFilters(value));
  // Muda a cada "Limpar" para remontar o campo Autor vazio.
  const [clearCount, setClearCount] = useState(0);
  const filtered = hasTimelineFilters(value);

  function change(changes: Partial<TimelineFilterValue>) {
    onChange({ ...value, ...changes });
  }

  return (
    <>
      <div className="ux-toolbar">
        <label className="field">
          <span>Busca</span>
          <span className="with-icon">
            <Icon name="search" className="icon-sm" />
            <input
              className="input"
              type="search"
              placeholder="Descrição ou autor do evento"
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
            aria-expanded={open}
            aria-controls="timeline-more"
            onClick={() => setOpen((current) => !current)}
          >
            <Icon name="filter" className="icon-sm" />
            Filtros
          </button>

          {filtered && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setClearCount((current) => current + 1);
                onChange(EMPTY_TIMELINE_FILTERS);
              }}
            >
              <Icon name="close" className="icon-sm" />
              Limpar
            </button>
          )}

          <label className="ux-sort" htmlFor="timeline-sort">
            <span>Ordenar por</span>
            <select className="select" id="timeline-sort" defaultValue="date">
              <option value="date">Data do evento</option>
            </select>
            <button
              type="button"
              className="btn btn-sm sort-dir"
              data-dir={order}
              aria-label={
                order === 'asc' ? 'Ordem crescente' : 'Ordem decrescente'
              }
              onClick={() => onOrderChange(order === 'asc' ? 'desc' : 'asc')}
            >
              <Icon
                name={order === 'asc' ? 'sortUp' : 'sortDown'}
                className="icon-sm"
              />
            </button>
          </label>
        </div>
      </div>

      <div className="filter-more" id="timeline-more" hidden={!open}>
        <MultiSelect
          label="Tipo do evento"
          options={TYPE_OPTIONS}
          value={value.types}
          onChange={(types) => change({ types: types as TimelineTargetType[] })}
        />

        <AuthorFilter
          key={clearCount}
          value={value.authorId}
          onChange={(authorId) => change({ authorId })}
          searchProfessionals={searchProfessionals}
          team={team}
        />

        <div className="field">
          <label className="field-label" htmlFor="timeline-period">
            Período
          </label>
          <select
            className="select"
            id="timeline-period"
            value={value.period}
            onChange={(event) =>
              change({
                period: event.target.value as TimelinePeriod,
                from: '',
                to: '',
              })
            }
          >
            <option value="">Qualquer período</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="custom">Personalizado</option>
          </select>

          {value.period === 'custom' && (
            <div className="range-custom">
              <input
                className="input"
                type="date"
                aria-label="De"
                value={value.from}
                max={value.to || undefined}
                onChange={(event) => change({ from: event.target.value })}
              />
              <input
                className="input"
                type="date"
                aria-label="Até"
                value={value.to}
                min={value.from || undefined}
                onChange={(event) => change({ to: event.target.value })}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

type AuthorFilterProps = {
  value: string;
  onChange: (authorId: string) => void;
  searchProfessionals: boolean;
  team: TimelinePerson[];
};

function sameName(a: string, b: string) {
  return (
    a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR')
  );
}

// Autor é quem executou. O paciente não consulta profissionais (RFPRO001) e escolhe na equipe.
function AuthorFilter({
  value,
  onChange,
  searchProfessionals,
  team,
}: AuthorFilterProps) {
  const [text, setText] = useState(
    () => team.find((person) => person.id === value)?.name ?? '',
  );
  const [found, setFound] = useState<TimelinePerson[]>([]);
  const options = searchProfessionals ? found : team;

  useEffect(() => {
    if (!value || !searchProfessionals || text) {
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
    // Só busca o nome ao abrir com um autor já escolhido (vindo da URL).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, searchProfessionals]);

  useEffect(() => {
    const term = text.trim();

    if (!searchProfessionals || term.length < 2) {
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      getProfessionals({ page: 1, limit: 10, name: term })
        .then((response) => {
          if (active) {
            setFound(response.data.map(({ id, name }) => ({ id, name })));
          }
        })
        .catch(() => undefined);
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchProfessionals, text]);

  function handleChange(next: string) {
    setText(next);
    const match = options.find((option) => sameName(option.name, next));

    if (match) {
      if (match.id !== value) {
        onChange(match.id);
      }
    } else if (value) {
      onChange('');
    }
  }

  return (
    <label className="field">
      <span>Autor</span>
      <input
        className="input"
        list="timeline-author-list"
        placeholder="Quem executou"
        autoComplete="off"
        value={text}
        onChange={(event) => handleChange(event.target.value)}
      />
      <datalist id="timeline-author-list">
        {options.map((option) => (
          <option key={option.id} value={option.name} />
        ))}
      </datalist>
    </label>
  );
}
