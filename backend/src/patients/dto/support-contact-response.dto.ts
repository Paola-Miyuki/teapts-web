// Este arquivo define o contrato público do contato de suporte.

/** Contato de suporte, com o identificador próprio. */
export class SupportContactResponseDto {
  /** @example 5f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b */
  id: string;
  /** @example Maria Martins */
  name: string;
  /** @example Avó */
  description: string | null;
  /** @example maria@exemplo.com */
  email: string | null;
  /** @example (11) 98765-4321 */
  phone: string | null;
  /** @example false */
  isEmergency: boolean;
}

/** Contatos de suporte do paciente. */
export class GetSupportContactsResponseDto {
  data: SupportContactResponseDto[];
}
