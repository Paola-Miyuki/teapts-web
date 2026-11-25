// Formatos de exibição e máscaras de campo usados nas telas (propriedades-front.md).

export function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

export const TIME_ZONE = 'America/Sao_Paulo';

/** Data e hora ISO em `dd/mm/aaaa`, no horário de Brasília. */
export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE });
}

/** Data `AAAA-MM-DD` em `dd/mm/aaaa`, sem passar por fuso horário. */
export function formatDateOnly(date: string) {
  const [year, month, day] = date.split('-');

  return `${day}/${month}/${year}`;
}

/** `000.000.000-00` enquanto a pessoa digita. */
export function maskCpf(value: string) {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

/** `(00) 00000-0000` (ou `(00) 0000-0000`) enquanto a pessoa digita. */
export function maskPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 2) {
    return digits.length ? `(${digits}` : '';
  }

  const area = digits.slice(0, 2);
  const number = digits.slice(2);
  const split = number.length > 8 ? 5 : 4;

  return number.length > split
    ? `(${area}) ${number.slice(0, split)}-${number.slice(split)}`
    : `(${area}) ${number}`;
}

export const formatCpf = maskCpf;
export const formatPhone = maskPhone;

/** CPF com 11 dígitos e os dois dígitos verificadores corretos. */
export function isValidCpf(value: string) {
  const digits = onlyDigits(value);

  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) {
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

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Idade em anos, meses e dias, como nos mockups ("41 anos, 10 meses e 2
 * dias"); as partes zeradas saem (propriedades-front.md).
 */
export function formatAge(birthDate: string, today = new Date()) {
  const [year, month, day] = birthDate.split('-').map(Number);
  let years = today.getFullYear() - year;
  let months = today.getMonth() + 1 - month;
  let days = today.getDate() - day;

  if (days < 0) {
    months -= 1;
    days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts = [
    years > 0 ? plural(years, 'ano', 'anos') : null,
    months > 0 ? plural(months, 'mês', 'meses') : null,
    days > 0 ? plural(days, 'dia', 'dias') : null,
  ].filter((part): part is string => part !== null);

  if (parts.length === 0) {
    return plural(0, 'dia', 'dias');
  }

  return parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}

/** Iniciais do primeiro e do último nome. */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  return `${parts[0]?.charAt(0) ?? ''}${parts.length > 1 ? parts[parts.length - 1].charAt(0) : ''}`.toUpperCase();
}

/** CEP com 8 dígitos em `00000-000`; outro formato fica como veio. */
export function formatCep(cep: string) {
  return cep.replace(/^(\d{5})(\d{3})$/, '$1-$2');
}
