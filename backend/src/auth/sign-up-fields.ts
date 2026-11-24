// Este arquivo valida e lê os campos do cadastro de conta (RFAUT001) enviados
// ao SuperTokens em `formFields`.

import { Gender } from '../accounts/enums/gender.enum';
import { Sex } from '../accounts/enums/sex.enum';

/** Chave do userContext com os dados da conta lidos no signUpPOST. */
export const SIGN_UP_ACCOUNT_KEY = 'teapts.signUpAccount';

export const SIGN_UP_FIELD_IDS = {
  name: 'name',
  socialName: 'socialName',
  birthDate: 'birthDate',
  sex: 'sex',
  gender: 'gender',
  cpf: 'cpf',
  phone: 'phone',
} as const;

export interface SignUpAccountFields {
  name: string;
  socialName: string | null;
  birthDate: string;
  sex: Sex;
  gender: Gender | null;
  cpf: string;
  phone: string | null;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const SEXES: readonly string[] = Object.values(Sex);
const GENDERS: readonly string[] = Object.values(Gender);

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** CPF com 11 dígitos e os dois dígitos verificadores corretos. */
export function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  const checkDigit = (length: number) => {
    let sum = 0;

    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (length + 1 - index);
    }

    const rest = (sum * 10) % 11;

    return rest === 10 ? 0 : rest;
  };

  return (
    checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10])
  );
}

/** Data `AAAA-MM-DD` que existe no calendário e não está no futuro. */
export function isValidBirthDate(value: string, today = new Date()): boolean {
  const match = DATE_ONLY.exec(value);

  if (!match) {
    return false;
  }

  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const exists =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  return exists && date.getTime() <= todayUtc;
}

export async function validateName(
  value: unknown,
): Promise<string | undefined> {
  if (typeof value !== 'string' || value.trim() === '') {
    return 'Informe o nome';
  }

  return undefined;
}

export async function validateSocialName(
  value: unknown,
): Promise<string | undefined> {
  return typeof value === 'string' ? undefined : 'Nome social inválido';
}

export async function validateBirthDate(
  value: unknown,
): Promise<string | undefined> {
  if (typeof value !== 'string' || !isValidBirthDate(value.trim())) {
    return 'Data de nascimento inválida';
  }

  return undefined;
}

export async function validateSex(value: unknown): Promise<string | undefined> {
  return typeof value === 'string' && SEXES.includes(value)
    ? undefined
    : 'Sexo inválido';
}

export async function validateGender(
  value: unknown,
): Promise<string | undefined> {
  return typeof value === 'string' && GENDERS.includes(value)
    ? undefined
    : 'Gênero inválido';
}

export async function validateCpf(value: unknown): Promise<string | undefined> {
  if (typeof value !== 'string' || !isValidCpf(onlyDigits(value))) {
    return 'CPF inválido';
  }

  return undefined;
}

export async function validatePhone(
  value: unknown,
): Promise<string | undefined> {
  if (typeof value !== 'string' || !/^\d{10,11}$/.test(onlyDigits(value))) {
    return 'Telefone inválido';
  }

  return undefined;
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Lê os dados da conta dos `formFields` já validados pelo SuperTokens; devolve
 * null quando falta um campo obrigatório.
 */
export function readSignUpFields(
  formFields: { id: string; value: unknown }[],
): SignUpAccountFields | null {
  const value = (id: string) =>
    formFields.find((field) => field.id === id)?.value;
  const name = optionalText(value(SIGN_UP_FIELD_IDS.name));
  const birthDate = optionalText(value(SIGN_UP_FIELD_IDS.birthDate));
  const sex = optionalText(value(SIGN_UP_FIELD_IDS.sex));
  const cpf = optionalText(value(SIGN_UP_FIELD_IDS.cpf));
  const gender = optionalText(value(SIGN_UP_FIELD_IDS.gender));
  const phone = optionalText(value(SIGN_UP_FIELD_IDS.phone));

  if (!name || !birthDate || !sex || !cpf) {
    return null;
  }

  return {
    name,
    socialName: optionalText(value(SIGN_UP_FIELD_IDS.socialName)),
    birthDate,
    sex: sex as Sex,
    gender: gender ? (gender as Gender) : null,
    cpf: onlyDigits(cpf),
    phone: phone ? onlyDigits(phone) : null,
  };
}
