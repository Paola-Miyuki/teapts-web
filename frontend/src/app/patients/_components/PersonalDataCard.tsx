'use client';

import type { ReactNode } from 'react';

import Icon from '@/components/Icon';
import { GENDER_LABELS } from '@/lib/account';
import {
  formatAge,
  formatCep,
  formatCpf,
  formatDateOnly,
  formatPhone,
} from '@/lib/format';
import { EDUCATION_LABELS, type PatientDetail } from '@/lib/patients';

function Value({ children }: { children: ReactNode }) {
  return children ? (
    <>{children}</>
  ) : (
    <span className="empty-cell" aria-label="Não informado">
      —
    </span>
  );
}

function formatCns(cns: string) {
  return cns.replace(/^(\d{3})(\d{4})(\d{4})(\d{4})$/, '$1 $2 $3 $4');
}

const SEX_INITIALS = { female: 'F', male: 'M' } as const;

type Field = { label: string; value: ReactNode };

function Section({ title, fields }: { title: string; fields: Field[] }) {
  return (
    <div className="ux-psec">
      <h3>{title}</h3>
      <dl className="ux-dl">
        {fields.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <Value>{value}</Value>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// CNS com o botão de copiar, como no mockup.
function CopyCns({ cns }: { cns: string }) {
  const formatted = formatCns(cns);

  return (
    <span className="copy-cell">
      {formatted}
      <button
        type="button"
        className="copy-btn"
        aria-label={`Copiar CNS ${formatted}`}
        onClick={() => void navigator.clipboard?.writeText(formatted)}
      >
        <Icon name="copy" className="icon-sm" />
      </button>
    </span>
  );
}

// Cartão "Dados pessoais" de `paciente.html` (aba Dados do paciente):
// identificação, endereço, responsável tutelar, escolaridade e unidade
// (propriedades-front.md, 3.2). Só leitura.
export default function PersonalDataCard({
  patient,
}: {
  patient: PatientDetail;
}) {
  const { address } = patient;

  return (
    <section className="ux-card" aria-labelledby="d-personal">
      <div className="ux-card-head">
        <div>
          <h2 id="d-personal">Dados pessoais</h2>
        </div>
      </div>

      <Section
        title="Identificação"
        fields={[
          { label: 'Nome completo', value: patient.name },
          { label: 'Nome social', value: patient.socialName },
          {
            label: 'Data de nascimento',
            value: patient.birthDate && formatDateOnly(patient.birthDate),
          },
          {
            label: 'Idade',
            value: patient.birthDate && formatAge(patient.birthDate),
          },
          {
            label: 'Sexo',
            value: patient.sex && SEX_INITIALS[patient.sex],
          },
          {
            label: 'Gênero',
            value: patient.gender && GENDER_LABELS[patient.gender],
          },
          { label: 'CPF', value: patient.cpf && formatCpf(patient.cpf) },
          {
            label: 'CNS (Cartão SUS)',
            value: patient.cns && <CopyCns cns={patient.cns} />,
          },
          { label: 'Filiação 1', value: patient.filiation1 },
          { label: 'Filiação 2', value: patient.filiation2 },
        ]}
      />

      <Section
        title="Endereço"
        fields={[
          {
            label: 'CEP',
            value: address.zipCode && formatCep(address.zipCode),
          },
          { label: 'Logradouro', value: address.street },
          { label: 'Número', value: address.number },
          { label: 'Complemento', value: address.complement },
          { label: 'Bairro', value: address.district },
          { label: 'Município', value: address.city },
          { label: 'UF', value: address.state?.toUpperCase() },
        ]}
      />

      <Section
        title="Responsável tutelar"
        fields={[
          { label: 'Responsável tutelar', value: patient.guardianName },
          {
            label: 'Telefone do responsável tutelar',
            value: patient.guardianPhone && formatPhone(patient.guardianPhone),
          },
        ]}
      />

      <Section
        title="Escolaridade e unidade"
        fields={[
          {
            label: 'Escolaridade',
            value: patient.educationLevel
              ? EDUCATION_LABELS[patient.educationLevel]
              : null,
          },
          { label: 'Instituição de ensino', value: patient.schoolName },
          { label: 'Unidade de referência', value: patient.referenceUnit },
        ]}
      />
    </section>
  );
}
