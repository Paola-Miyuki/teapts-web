'use client';

import { useEffect, useState } from 'react';

import Combobox from '@/components/Combobox';
import ui from '@/components/ui.module.css';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '@/lib/documents';
import { getProfessionals, type Professional } from '@/lib/professionals';

export type IssuerKind = 'professional' | 'outside';

export type DocumentFormValues = {
  title: string;
  category: DocumentCategory | '';
  issueDate: string;
  issuerKind: IssuerKind;
  // Conta escolhida na lista; vazia até o usuário escolher alguém.
  issuerAccountId: string;
  issuerName: string;
  description: string;
};

export const EMPTY_DOCUMENT_VALUES: DocumentFormValues = {
  title: '',
  category: '',
  issueDate: '',
  issuerKind: 'professional',
  issuerAccountId: '',
  issuerName: '',
  description: '',
};

export type DocumentFormErrors = Partial<Record<'title' | 'category', string>>;

type DocumentFormProps = {
  values: DocumentFormValues;
  errors: DocumentFormErrors;
  disabled: boolean;
  // Só o admin recebe a conta do profissional (DP011), então só ele escolhe
  // "Profissional"; os demais informam o emissor como texto.
  canPickProfessional: boolean;
  onChange: (changes: Partial<DocumentFormValues>) => void;
};

// Seção "Dados do documento" de `enviar-documento.html` (RFDOC002): título,
// categoria, data de emissão, emissor (só o campo da escolha aparece) e
// descrição. O estado e a validação ficam em quem usa o componente.
export default function DocumentForm({
  values,
  errors,
  disabled,
  canPickProfessional,
  onChange,
}: DocumentFormProps) {
  const kind = canPickProfessional ? values.issuerKind : 'outside';

  return (
    <section className="ux-fsection">
      <header>
        <h3>Dados do documento</h3>
      </header>
      <div>
        <div className="form-grid">
          <div className="field full">
            <label className="field-label" htmlFor="doc-title">
              Título
              <span className="ux-req" aria-hidden="true">
                {' '}
                *
              </span>
            </label>
            <input
              className="input"
              id="doc-title"
              type="text"
              value={values.title}
              disabled={disabled}
              placeholder="Ex.: Laudo neurológico"
              aria-required="true"
              aria-invalid={errors.title ? 'true' : 'false'}
              aria-describedby={errors.title ? 'doc-title-error' : undefined}
              onChange={(event) => onChange({ title: event.target.value })}
            />
            {errors.title ? (
              <p id="doc-title-error" className={ui.fieldError} role="alert">
                {errors.title}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="doc-category">
              Categoria
              <span className="ux-req" aria-hidden="true">
                {' '}
                *
              </span>
            </label>
            <select
              className="select"
              id="doc-category"
              value={values.category}
              disabled={disabled}
              aria-required="true"
              aria-invalid={errors.category ? 'true' : 'false'}
              aria-describedby={
                errors.category ? 'doc-category-error' : undefined
              }
              onChange={(event) =>
                onChange({
                  category: event.target.value as DocumentCategory | '',
                })
              }
            >
              <option value="">Selecione a categoria</option>
              {DOCUMENT_CATEGORIES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {errors.category ? (
              <p id="doc-category-error" className={ui.fieldError} role="alert">
                {errors.category}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="doc-issued">
              Data de emissão
            </label>
            <input
              className="input"
              id="doc-issued"
              type="date"
              value={values.issueDate}
              disabled={disabled}
              onChange={(event) => onChange({ issueDate: event.target.value })}
            />
          </div>

          <div className="field full">
            <span className="field-label" id="doc-issuer-label">
              Quem emitiu
            </span>

            {canPickProfessional ? (
              <div
                className="ux-seg"
                role="radiogroup"
                aria-labelledby="doc-issuer-label"
              >
                <label className="ux-seg-opt ux-seg-primary">
                  <input
                    type="radio"
                    name="emitter-kind"
                    value="professional"
                    checked={kind === 'professional'}
                    disabled={disabled}
                    onChange={() => onChange({ issuerKind: 'professional' })}
                  />
                  Profissional
                </label>
                <label className="ux-seg-opt ux-seg-primary">
                  <input
                    type="radio"
                    name="emitter-kind"
                    value="outside"
                    checked={kind === 'outside'}
                    disabled={disabled}
                    onChange={() => onChange({ issuerKind: 'outside' })}
                  />
                  Alguém de fora
                </label>
              </div>
            ) : null}

            {kind === 'professional' ? (
              <ProfessionalIssuer
                disabled={disabled}
                onSelect={(issuerAccountId) => onChange({ issuerAccountId })}
              />
            ) : (
              <input
                className="input"
                aria-label="Emissor de fora"
                placeholder="Ex.: Dra. Lúcia Prado, CRM-PR 33210, Hospital Pequeno Príncipe"
                value={values.issuerName}
                disabled={disabled}
                onChange={(event) =>
                  onChange({ issuerName: event.target.value })
                }
              />
            )}
          </div>

          <div className="field full">
            <label className="field-label" htmlFor="doc-description">
              Descrição
            </label>
            <textarea
              className="input"
              id="doc-description"
              rows={3}
              value={values.description}
              disabled={disabled}
              onChange={(event) =>
                onChange({ description: event.target.value })
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// Lista de profissionais com busca no servidor por nome (RFPRO001). Só os
// que têm conta na resposta entram: é ela que a API grava como emissor.
function ProfessionalIssuer({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (accountId: string) => void;
}) {
  const search = useDebouncedSearch();
  const { term } = search;
  const [professionals, setProfessionals] = useState<Professional[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    getProfessionals({ page: 1, limit: 10, q: term }, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) {
          setProfessionals(response.data);
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [term]);

  const options = professionals.flatMap((professional) =>
    professional.accountId
      ? [
          {
            value: professional.accountId,
            label: `${professional.name} · ${professional.specialism.name}`,
          },
        ]
      : [],
  );

  return (
    <div style={{ marginTop: 8 }}>
      <Combobox
        id="doc-issuer-professional"
        options={options}
        input={search.input}
        onInputChange={(text) => {
          search.setInput(text);
          // Digitar de novo desfaz a escolha anterior.
          onSelect('');
        }}
        onSelect={(option) => {
          search.setInput(option.label);
          onSelect(option.value);
        }}
        placeholder="Busque o profissional pelo nome"
        emptyText="Nenhum profissional encontrado"
        listLabel="Profissionais"
        disabled={disabled}
      />
    </div>
  );
}
