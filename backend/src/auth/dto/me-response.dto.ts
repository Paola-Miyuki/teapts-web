// Este arquivo define a resposta do GET /me.

import { AccountRole } from '../../accounts/enums/account-role.enum';

/** Dados públicos da conta da sessão atual. */
export class MeResponseDto {
  accountId: string;
  name: string;
  email: string;
  role: AccountRole;
  /** Perfil de paciente da conta, ou null quando ela não tem. */
  patientProfileId: string | null;
  professionalProfileIds: string[];
}
