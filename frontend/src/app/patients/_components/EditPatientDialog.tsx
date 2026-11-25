'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import FormField from '@/components/FormField';
import HelpTooltip from '@/components/HelpTooltip';
import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import {
  formatAge,
  isValidCpf,
  maskCpf,
  maskPhone,
  onlyDigits,
} from '@/lib/format';
import { COUNCIL_STATES } from '@/lib/professionals';
import {
  updateClinicalData,
  updatePatient,
  type ClinicalDataPatch,
  type EducationLevel,
  type PatientDetail,
  type SupportContact,
  type UpdatePatientInput,
} from '@/lib/patients';
import { formatPhone } from '@/lib/format';
import RemoveSupportContactDialog from './RemoveSupportContactDialog';
import SupportContactDialog from './SupportContactDialog';

const FORM_ID = 'pat-edit';
const SAVE_ERROR = 'Não foi possível salvar os dados do paciente';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Escolaridade, com os grupos e os rótulos do select de `paciente.html`.
const EDUCATION_GROUPS: {
  label: string;
  options: { value: EducationLevel; label: string }[];
}[] = [
  {
    label: 'Educação Infantil',
    options: [
      { value: 'early_childhood_daycare', label: 'Educação Infantil: creche' },
      {
        value: 'early_childhood_preschool',
        label: 'Educação Infantil: pré-escola',
      },
    ],
  },
  {
    label: 'Ensino Fundamental (1º ao 9º ano)',
    options: [
      {
        value: 'elementary_incomplete',
        label: 'Ensino Fundamental incompleto',
      },
      { value: 'elementary_ongoing', label: 'Ensino Fundamental cursando' },
      { value: 'elementary_complete', label: 'Ensino Fundamental completo' },
    ],
  },
  {
    label: 'Ensino Médio',
    options: [
      { value: 'high_school_incomplete', label: 'Ensino Médio incompleto' },
      { value: 'high_school_ongoing', label: 'Ensino Médio cursando' },
      { value: 'high_school_complete', label: 'Ensino Médio completo' },
    ],
  },
  {
    label: 'Técnico / Profissionalizante',
    options: [
      { value: 'technical_incomplete', label: 'Técnico incompleto' },
      { value: 'technical_ongoing', label: 'Técnico cursando' },
      { value: 'technical_complete', label: 'Técnico concluído' },
    ],
  },
  {
    label: 'Ensino Superior (bacharelado, licenciatura ou tecnólogo)',
    options: [
      { value: 'undergraduate_incomplete', label: 'Graduação incompleta' },
      { value: 'undergraduate_ongoing', label: 'Graduação cursando' },
      { value: 'undergraduate_complete', label: 'Graduação concluída' },
    ],
  },
  {
    label: 'Pós-graduação',
    options: [
      {
        value: 'postgraduate_specialization',
        label: 'Pós-graduação: especialização',
      },
      { value: 'postgraduate_mba', label: 'Pós-graduação: MBA' },
      { value: 'postgraduate_masters', label: 'Pós-graduação: mestrado' },
      { value: 'postgraduate_doctorate', label: 'Pós-graduação: doutorado' },
    ],
  },
];

// Anamnese do histórico clínico, com a ajuda de cada campo.
const HISTORY_FIELDS = [
  {
    key: 'clinicalHistory',
    label: 'Antecedentes clínicos',
    help: 'Inclui os antecedentes gestacionais e perinatais (gestação, parto e intercorrências ao nascer).',
  },
  {
    key: 'surgicalHistory',
    label: 'Antecedentes cirúrgicos',
    help: 'Cirurgias e procedimentos, com o ano.',
  },
  {
    key: 'familyHistory',
    label: 'Antecedentes familiares',
    help: 'Inclui o histórico familiar de neurodivergências.',
  },
  {
    key: 'habits',
    label: 'Hábitos',
    placeholder: 'Ex.: sono, alimentação e uso de telas',
  },
  {
    key: 'developmentalMilestones',
    label: 'Marcos do desenvolvimento',
    help: 'Quando sentou, andou, falou e outros marcos.',
  },
] as const;

type HistoryKey = (typeof HISTORY_FIELDS)[number]['key'];

type Form = {
  name: string;
  socialName: string;
  birthDate: string;
  sex: string;
  cpf: string;
  phone: string;
  email: string;
  guardianName: string;
  guardianPhone: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  filiation1: string;
  filiation2: string;
  referenceUnit: string;
  educationLevel: string;
  schoolName: string;
  allergies: string;
  noKnownAllergies: boolean;
} & Record<HistoryKey, string>;

type Errors = Partial<Record<keyof Form, string>>;

function maskCep(value: string) {
  const digits = onlyDigits(value).slice(0, 8);

  return digits.length > 5
    ? `${digits.slice(0, 5)}-${digits.slice(5)}`
    : digits;
}

function toForm(patient: PatientDetail): Form {
  const { address } = patient;

  return {
    name: patient.name,
    socialName: patient.socialName ?? '',
    birthDate: patient.birthDate ?? '',
    sex: patient.sex ?? '',
    cpf: patient.cpf ? maskCpf(patient.cpf) : '',
    phone: patient.phone ? maskPhone(patient.phone) : '',
    email: patient.email,
    guardianName: patient.guardianName ?? '',
    guardianPhone: patient.guardianPhone
      ? maskPhone(patient.guardianPhone)
      : '',
    zipCode: address.zipCode ? maskCep(address.zipCode) : '',
    street: address.street ?? '',
    number: address.number ?? '',
    complement: address.complement ?? '',
    district: address.district ?? '',
    city: address.city ?? '',
    state: address.state?.toUpperCase() ?? '',
    filiation1: patient.filiation1 ?? '',
    filiation2: patient.filiation2 ?? '',
    referenceUnit: patient.referenceUnit ?? '',
    educationLevel: patient.educationLevel ?? '',
    schoolName: patient.schoolName ?? '',
    allergies: patient.allergies ?? '',
    noKnownAllergies: patient.noKnownAllergies,
    clinicalHistory: patient.clinicalHistory ?? '',
    surgicalHistory: patient.surgicalHistory ?? '',
    familyHistory: patient.familyHistory ?? '',
    habits: patient.habits ?? '',
    developmentalMilestones: patient.developmentalMilestones ?? '',
  };
}

const orNull = (value: string) => value.trim() || null;

type EditPatientDialogProps = {
  patient: PatientDetail;
  contacts: SupportContact[];
  // O profissional edita só os dados do paciente: os da conta ficam
  // desabilitados (RFPAC007).
  canEditAccount: boolean;
  onContactsChange: (contacts: SupportContact[]) => void;
  onSaved: (patient: PatientDetail) => void;
  onClose: () => void;
};

type ContactDialog =
  | { kind: 'add' }
  | { kind: 'edit'; contact: SupportContact }
  | { kind: 'remove'; contact: SupportContact }
  | null;

// Modal "Editar paciente" de `paciente.html` (RFPAC003, RFPAC007): dados da
// conta, dados do paciente, histórico clínico e contatos de suporte. Os
// contatos são salvos na hora, separados do formulário. Monte só com o modal
// aberto, para os campos começarem do paciente certo.
export default function EditPatientDialog({
  patient,
  contacts,
  canEditAccount,
  onContactsChange,
  onSaved,
  onClose,
}: EditPatientDialogProps) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => toForm(patient));
  const [errors, setErrors] = useState<Errors>({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [contactDialog, setContactDialog] = useState<ContactDialog>(null);

  const id = (field: string) => `${FORM_ID}-${field}`;

  function set<K extends keyof Form>(field: K, value: Form[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function validate(): Errors {
    const found: Errors = {};
    const required = 'Campo obrigatório';

    if (canEditAccount) {
      if (!form.name.trim()) found.name = 'Informe o nome completo';
      if (
        !form.birthDate ||
        form.birthDate > new Date().toISOString().slice(0, 10)
      ) {
        found.birthDate = 'Informe uma data de nascimento válida';
      }
      if (!form.sex) found.sex = 'Selecione o sexo';
      if (!isValidCpf(form.cpf)) found.cpf = 'Informe um CPF válido';
      if (onlyDigits(form.phone) && onlyDigits(form.phone).length < 10) {
        found.phone = 'Informe o telefone com DDD';
      }
      if (!EMAIL_PATTERN.test(form.email.trim())) {
        found.email = 'Informe um e-mail válido, como nome@exemplo.com';
      }
    }

    const guardianPhone = onlyDigits(form.guardianPhone);

    if (guardianPhone && guardianPhone.length < 10) {
      found.guardianPhone = 'Informe o telefone com DDD';
    }

    if (
      form.birthDate &&
      Number.parseInt(formatAge(form.birthDate), 10) < 18 &&
      !form.guardianName.trim()
    ) {
      found.guardianName = 'Obrigatório para menor de 18 anos';
    }

    if (onlyDigits(form.zipCode).length !== 8) found.zipCode = 'Informe o CEP';
    if (!form.street.trim()) found.street = required;
    if (!form.number.trim()) found.number = required;
    if (!form.district.trim()) found.district = required;
    if (!form.city.trim()) found.city = required;
    if (!form.state) found.state = required;
    if (!form.filiation1.trim()) found.filiation1 = required;

    return found;
  }

  // Só vão nos PATCH os campos que mudaram.
  function patientChanges(): UpdatePatientInput {
    const input: UpdatePatientInput = {};
    const address: NonNullable<UpdatePatientInput['address']> = {};
    const { address: current } = patient;

    if (canEditAccount) {
      if (form.name.trim() !== patient.name) input.name = form.name.trim();
      if (orNull(form.socialName) !== patient.socialName) {
        input.socialName = orNull(form.socialName);
      }
      if (form.birthDate !== patient.birthDate)
        input.birthDate = form.birthDate;
      if (form.sex !== patient.sex) input.sex = form.sex as 'male' | 'female';
      if (onlyDigits(form.cpf) !== (patient.cpf ?? '')) {
        input.cpf = onlyDigits(form.cpf);
      }
      if ((onlyDigits(form.phone) || null) !== patient.phone) {
        input.phone = onlyDigits(form.phone) || null;
      }
      if (form.email.trim().toLowerCase() !== patient.email) {
        input.email = form.email.trim();
      }
    }

    if (orNull(form.guardianName) !== patient.guardianName) {
      input.guardianName = orNull(form.guardianName);
    }
    if ((onlyDigits(form.guardianPhone) || null) !== patient.guardianPhone) {
      input.guardianPhone = onlyDigits(form.guardianPhone) || null;
    }
    if (onlyDigits(form.zipCode) !== (current.zipCode ?? '')) {
      address.zipCode = onlyDigits(form.zipCode);
    }
    if (form.street.trim() !== (current.street ?? '')) {
      address.street = form.street.trim();
    }
    if (form.number.trim() !== (current.number ?? '')) {
      address.number = form.number.trim();
    }
    if (orNull(form.complement) !== current.complement) {
      address.complement = orNull(form.complement);
    }
    if (form.district.trim() !== (current.district ?? '')) {
      address.district = form.district.trim();
    }
    if (form.city.trim() !== (current.city ?? '')) {
      address.city = form.city.trim();
    }
    if (form.state.toLowerCase() !== (current.state ?? '')) {
      address.state = form.state.toLowerCase();
    }
    if (Object.keys(address).length > 0) input.address = address;
    if (form.filiation1.trim() !== (patient.filiation1 ?? '')) {
      input.filiation1 = form.filiation1.trim();
    }
    if (orNull(form.filiation2) !== patient.filiation2) {
      input.filiation2 = orNull(form.filiation2);
    }
    if (orNull(form.referenceUnit) !== patient.referenceUnit) {
      input.referenceUnit = orNull(form.referenceUnit);
    }
    if ((form.educationLevel || null) !== patient.educationLevel) {
      input.educationLevel = (form.educationLevel ||
        null) as EducationLevel | null;
    }
    if (orNull(form.schoolName) !== patient.schoolName) {
      input.schoolName = orNull(form.schoolName);
    }

    return input;
  }

  function clinicalChanges(): ClinicalDataPatch {
    const patch: ClinicalDataPatch = {};

    for (const { key } of HISTORY_FIELDS) {
      if (form[key].trim() !== (patient[key] ?? '')) {
        patch[key] = form[key].trim();
      }
    }

    const allergies = form.noKnownAllergies ? '' : form.allergies.trim();

    if (
      form.noKnownAllergies !== patient.noKnownAllergies ||
      allergies !== (patient.allergies ?? '')
    ) {
      patch.noKnownAllergies = form.noKnownAllergies;
      patch.allergies = allergies;
    }

    return patch;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setApiError('');
    const found = validate();
    setErrors(found);

    const first = (Object.keys(found) as (keyof Form)[])[0];

    if (first) {
      document.getElementById(id(first))?.focus();
      return;
    }

    const patientInput = patientChanges();
    const clinicalInput = clinicalChanges();

    setSubmitting(true);

    try {
      let saved = patient;

      if (Object.keys(patientInput).length > 0) {
        saved = await updatePatient(patient.id, patientInput);
      }

      if (Object.keys(clinicalInput).length > 0) {
        saved = {
          ...saved,
          ...(await updateClinicalData(patient.id, clinicalInput)),
        };
      }

      onSaved({ ...saved, supportContacts: contacts });
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        router.replace('/login');
        return;
      }

      if (failure instanceof ApiError) {
        if (failure.code === 'EMAIL_ALREADY_EXISTS') {
          setErrors({ email: failure.apiMessage ?? 'E-mail já cadastrado' });
        } else if (failure.code === 'CPF_ALREADY_EXISTS') {
          setErrors({ cpf: failure.apiMessage ?? 'CPF já cadastrado' });
        }
      }

      setApiError(
        failure instanceof ApiError && failure.apiMessage
          ? failure.apiMessage
          : SAVE_ERROR,
      );
      setSubmitting(false);
    }
  }

  const accountDisabled = submitting || !canEditAccount;

  return (
    <>
      <Modal
        open
        id={FORM_ID}
        size="lg"
        title={`Editar ${patient.name}`}
        busy={submitting}
        onClose={onClose}
        footer={
          <>
            <button
              type="button"
              className="btn"
              disabled={submitting}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form={FORM_ID}
              className="btn btn-primary"
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </>
        }
      >
        <form id={FORM_ID} noValidate onSubmit={handleSubmit}>
          {apiError && (
            <div className={`${ui.alert} ${ui.alertError}`} role="alert">
              <p>{apiError}</p>
            </div>
          )}

          <section>
            <h3>Dados da conta</h3>
            <div className="form-grid">
              <FormField
                id={id('name')}
                label="Nome completo"
                error={errors.name}
              >
                <input
                  id={id('name')}
                  className="input"
                  type="text"
                  aria-required
                  placeholder="Ex.: Maria da Silva"
                  disabled={accountDisabled}
                  value={form.name}
                  onChange={(event) => set('name', event.target.value)}
                />
              </FormField>
              <FormField
                id={id('socialName')}
                label="Nome social"
                required={false}
              >
                <input
                  id={id('socialName')}
                  className="input"
                  type="text"
                  placeholder="Ex.: Alex Souza"
                  disabled={accountDisabled}
                  value={form.socialName}
                  onChange={(event) => set('socialName', event.target.value)}
                />
              </FormField>
              <FormField
                id={id('birthDate')}
                label="Data de nascimento"
                error={errors.birthDate}
              >
                <input
                  id={id('birthDate')}
                  className="input"
                  type="date"
                  aria-required
                  disabled={accountDisabled}
                  value={form.birthDate}
                  onChange={(event) => set('birthDate', event.target.value)}
                />
              </FormField>
              <FormField id={id('sex')} label="Sexo" error={errors.sex}>
                <select
                  id={id('sex')}
                  className="select"
                  aria-required
                  disabled={accountDisabled}
                  value={form.sex}
                  onChange={(event) => set('sex', event.target.value)}
                >
                  <option value="male">M</option>
                  <option value="female">F</option>
                </select>
              </FormField>
              <FormField id={id('cpf')} label="CPF" error={errors.cpf}>
                <input
                  id={id('cpf')}
                  className="input"
                  type="text"
                  inputMode="numeric"
                  aria-required
                  placeholder="000.000.000-00"
                  disabled={accountDisabled}
                  value={form.cpf}
                  onChange={(event) => set('cpf', maskCpf(event.target.value))}
                />
              </FormField>
              <FormField
                id={id('phone')}
                label="Telefone"
                required={false}
                error={errors.phone}
              >
                <input
                  id={id('phone')}
                  className="input"
                  type="tel"
                  placeholder="(00) 00000-0000"
                  disabled={accountDisabled}
                  value={form.phone}
                  onChange={(event) =>
                    set('phone', maskPhone(event.target.value))
                  }
                />
              </FormField>
              <FormField
                id={id('email')}
                label="E-mail"
                full
                error={errors.email}
              >
                <input
                  id={id('email')}
                  className="input"
                  type="email"
                  aria-required
                  placeholder="nome@exemplo.com"
                  disabled={accountDisabled}
                  value={form.email}
                  onChange={(event) => set('email', event.target.value)}
                />
              </FormField>
            </div>
          </section>

          <section>
            <h3>Dados do paciente</h3>
            <div className="form-grid">
              <FormField
                id={id('guardianName')}
                label="Responsável tutelar"
                help="Obrigatório para menor de 18 anos."
                required={false}
                error={errors.guardianName}
              >
                <input
                  id={id('guardianName')}
                  className="input"
                  type="text"
                  placeholder="Ex.: Maria da Silva"
                  disabled={submitting}
                  value={form.guardianName}
                  onChange={(event) => set('guardianName', event.target.value)}
                />
              </FormField>
              <FormField
                id={id('guardianPhone')}
                label="Telefone do responsável tutelar"
                required={false}
                error={errors.guardianPhone}
              >
                <input
                  id={id('guardianPhone')}
                  className="input"
                  type="tel"
                  placeholder="(00) 00000-0000"
                  disabled={submitting}
                  value={form.guardianPhone}
                  onChange={(event) =>
                    set('guardianPhone', maskPhone(event.target.value))
                  }
                />
              </FormField>
              <FormField id={id('zipCode')} label="CEP" error={errors.zipCode}>
                <input
                  id={id('zipCode')}
                  className="input"
                  type="text"
                  inputMode="numeric"
                  aria-required
                  placeholder="00000-000"
                  disabled={submitting}
                  value={form.zipCode}
                  onChange={(event) =>
                    set('zipCode', maskCep(event.target.value))
                  }
                />
              </FormField>
              <FormField
                id={id('street')}
                label="Logradouro"
                error={errors.street}
              >
                <input
                  id={id('street')}
                  className="input"
                  type="text"
                  aria-required
                  placeholder="Ex.: Rua das Flores"
                  disabled={submitting}
                  value={form.street}
                  onChange={(event) => set('street', event.target.value)}
                />
              </FormField>
              <FormField id={id('number')} label="Número" error={errors.number}>
                <input
                  id={id('number')}
                  className="input"
                  type="text"
                  aria-required
                  placeholder="Ex.: 123"
                  disabled={submitting}
                  value={form.number}
                  onChange={(event) => set('number', event.target.value)}
                />
              </FormField>
              <FormField
                id={id('complement')}
                label="Complemento"
                required={false}
              >
                <input
                  id={id('complement')}
                  className="input"
                  type="text"
                  placeholder="Ex.: apto 12, bloco B"
                  disabled={submitting}
                  value={form.complement}
                  onChange={(event) => set('complement', event.target.value)}
                />
              </FormField>
              <FormField
                id={id('district')}
                label="Bairro"
                error={errors.district}
              >
                <input
                  id={id('district')}
                  className="input"
                  type="text"
                  aria-required
                  placeholder="Ex.: Centro"
                  disabled={submitting}
                  value={form.district}
                  onChange={(event) => set('district', event.target.value)}
                />
              </FormField>
              <div className="third">
                <FormField
                  id={id('city')}
                  label="Município"
                  error={errors.city}
                >
                  <input
                    id={id('city')}
                    className="input"
                    type="text"
                    aria-required
                    placeholder="Ex.: Curitiba"
                    disabled={submitting}
                    value={form.city}
                    onChange={(event) => set('city', event.target.value)}
                  />
                </FormField>
                <FormField id={id('state')} label="UF" error={errors.state}>
                  <select
                    id={id('state')}
                    className="select"
                    aria-required
                    disabled={submitting}
                    value={form.state}
                    onChange={(event) => set('state', event.target.value)}
                  >
                    <option value="" />
                    {COUNCIL_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
              <FormField
                id={id('filiation1')}
                label="Filiação 1"
                help={'Aceita "Não declarado".'}
                error={errors.filiation1}
              >
                <input
                  id={id('filiation1')}
                  className="input"
                  type="text"
                  aria-required
                  placeholder="Ex.: Maria da Silva"
                  disabled={submitting}
                  value={form.filiation1}
                  onChange={(event) => set('filiation1', event.target.value)}
                />
              </FormField>
              <FormField
                id={id('filiation2')}
                label="Filiação 2"
                required={false}
              >
                <input
                  id={id('filiation2')}
                  className="input"
                  type="text"
                  placeholder="Ex.: João da Silva"
                  disabled={submitting}
                  value={form.filiation2}
                  onChange={(event) => set('filiation2', event.target.value)}
                />
              </FormField>
              <FormField
                id={id('referenceUnit')}
                label="Unidade de referência"
                required={false}
              >
                <input
                  id={id('referenceUnit')}
                  className="input"
                  type="text"
                  placeholder="Ex.: UBS, CER ou CAPS"
                  disabled={submitting}
                  value={form.referenceUnit}
                  onChange={(event) => set('referenceUnit', event.target.value)}
                />
              </FormField>
              <div className="field">
                <label className="field-label" htmlFor={id('educationLevel')}>
                  Escolaridade
                </label>
                <select
                  id={id('educationLevel')}
                  className="select"
                  disabled={submitting}
                  value={form.educationLevel}
                  onChange={(event) =>
                    set('educationLevel', event.target.value)
                  }
                >
                  <option value="">Não informada</option>
                  {EDUCATION_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <FormField
                id={id('schoolName')}
                label="Instituição de ensino"
                required={false}
                full
              >
                <input
                  id={id('schoolName')}
                  className="input"
                  type="text"
                  placeholder="Ex.: Escola Municipal Monteiro Lobato"
                  disabled={submitting}
                  value={form.schoolName}
                  onChange={(event) => set('schoolName', event.target.value)}
                />
              </FormField>
              <FormField
                id={id('allergies')}
                label="Alergias e restrições"
                required={false}
                full
              >
                <textarea
                  id={id('allergies')}
                  className="input"
                  rows={3}
                  placeholder="Ex.: alergia a amoxicilina; sem lactose"
                  disabled={submitting || form.noKnownAllergies}
                  value={form.allergies}
                  onChange={(event) => set('allergies', event.target.value)}
                />
                <label className="ux-check">
                  <input
                    type="checkbox"
                    disabled={submitting}
                    checked={form.noKnownAllergies}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        noKnownAllergies: event.target.checked,
                        allergies: event.target.checked
                          ? ''
                          : current.allergies,
                      }))
                    }
                  />
                  Nenhuma alergia conhecida
                </label>
              </FormField>
            </div>
          </section>

          <section>
            <h3>Histórico clínico</h3>
            <div className="form-grid">
              {HISTORY_FIELDS.map((field) => (
                <FormField
                  key={field.key}
                  id={id(field.key)}
                  label={field.label}
                  help={'help' in field ? field.help : undefined}
                  required={false}
                  full
                >
                  <textarea
                    id={id(field.key)}
                    className="input"
                    rows={3}
                    placeholder={
                      'placeholder' in field ? field.placeholder : undefined
                    }
                    disabled={submitting}
                    value={form[field.key]}
                    onChange={(event) => set(field.key, event.target.value)}
                  />
                </FormField>
              ))}
            </div>
          </section>

          <section>
            <span className="ux-titletip">
              <h3>Contatos de suporte</h3>
              <HelpTooltip id="pat-contacts-tip" label="Contatos de suporte">
                Cada contato é salvo na hora, separado deste formulário.
              </HelpTooltip>
            </span>

            {contacts.length > 0 && (
              <ul className="mini-list">
                {contacts.map((contact) => (
                  <li key={contact.id}>
                    <span className="grow">
                      <strong>{contact.name}</strong>
                      {contact.isEmergency && (
                        <span className="badge rejected">Emergência</span>
                      )}
                      {contact.description && (
                        <small className="ux-sub">
                          <span className="ux-sublabel">Descrição:</span>{' '}
                          {contact.description}
                        </small>
                      )}
                      {contact.email && (
                        <small className="ux-sub">
                          <span className="ux-sublabel">E-mail:</span>{' '}
                          {contact.email}
                        </small>
                      )}
                      {contact.phone && (
                        <small className="ux-sub">
                          <span className="ux-sublabel">Telefone:</span>{' '}
                          {formatPhone(contact.phone)}
                        </small>
                      )}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm"
                      aria-label={`Editar ${contact.name}`}
                      disabled={submitting}
                      onClick={() =>
                        setContactDialog({ kind: 'edit', contact })
                      }
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      aria-label={`Remover ${contact.name}`}
                      disabled={submitting}
                      onClick={() =>
                        setContactDialog({ kind: 'remove', contact })
                      }
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              className="btn btn-sm"
              style={{ marginTop: 10 }}
              disabled={submitting}
              onClick={() => setContactDialog({ kind: 'add' })}
            >
              <Icon name="plus" className="icon-sm" />
              Adicionar contato
            </button>
          </section>
        </form>
      </Modal>

      {contactDialog?.kind === 'add' && (
        <SupportContactDialog
          patientId={patient.id}
          patientName={patient.name}
          onClose={() => setContactDialog(null)}
          onSaved={(saved) => {
            onContactsChange([...contacts, saved]);
            setContactDialog(null);
          }}
        />
      )}
      {contactDialog?.kind === 'edit' && (
        <SupportContactDialog
          patientId={patient.id}
          patientName={patient.name}
          contact={contactDialog.contact}
          onClose={() => setContactDialog(null)}
          onSaved={(saved) => {
            onContactsChange(
              contacts.map((current) =>
                current.id === saved.id ? saved : current,
              ),
            );
            setContactDialog(null);
          }}
        />
      )}
      <RemoveSupportContactDialog
        patientId={patient.id}
        contact={
          contactDialog?.kind === 'remove' ? contactDialog.contact : null
        }
        onClose={() => setContactDialog(null)}
        onRemoved={(removed) => {
          onContactsChange(
            contacts.filter((current) => current.id !== removed.id),
          );
          setContactDialog(null);
        }}
      />
    </>
  );
}
