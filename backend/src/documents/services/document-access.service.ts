// Este arquivo decide quem acessa os documentos de um paciente. Admin acessa
// qualquer paciente; o profissional, pelo vínculo (RN016), com PTS encerrado
// só lendo; o paciente, só o próprio id (RN028).

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { isAdmin } from '../../auth/account-context';
import { PatientsRepository } from '../../patients/repositories/patients.repository';

@Injectable()
export class DocumentAccessService {
  constructor(private readonly patientsRepository: PatientsRepository) {}

  /**
   * Confere o acesso aos documentos do paciente.
   *
   * @param mode `write` exige PTS ativo para o profissional (acesso de
   *   leitura vale também para PTS concluído ou cancelado)
   * @throws NotFoundException `PATIENT_NOT_FOUND` quando o paciente não existe
   * @throws ForbiddenException `FORBIDDEN` quando a conta não tem acesso
   */
  async assertAccess(
    account: AccountContext,
    patientId: string,
    mode: 'read' | 'write',
  ): Promise<void> {
    if (!(await this.patientsRepository.patientExists(patientId))) {
      throw new NotFoundException({
        status: 'PATIENT_NOT_FOUND',
        message: 'Paciente não encontrado.',
      });
    }

    if (isAdmin(account) || account.patientProfileId === patientId) {
      return;
    }

    const forbidden = () =>
      new ForbiddenException({
        status: 'FORBIDDEN',
        message: 'Você não tem acesso aos documentos deste paciente.',
      });

    if (account.professionalProfileIds.length === 0) {
      throw forbidden();
    }

    const row = await this.patientsRepository.findPatient(
      { kind: 'professional', accountId: account.accountId },
      patientId,
    );

    if (!row || (mode === 'write' && row.read_only)) {
      throw forbidden();
    }
  }
}
