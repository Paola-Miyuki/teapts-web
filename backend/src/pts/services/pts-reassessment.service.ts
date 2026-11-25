import { Injectable } from '@nestjs/common';

import type { AccountContext } from '../../accounts/services/accounts.service';
import { isAdmin } from '../../auth/account-context';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import type {
  RegisterReassessmentRequestDto,
  RegisterReassessmentResponseDto,
} from '../dto/register-reassessment.dto';
import { ptsNotFound } from '../pts.errors';
import { assertGoalsAssessed } from '../reassessment-rules';
import {
  reassessmentForbidden,
  reassessmentNotRunning,
} from '../reassessment.errors';
import { PtsGoalsRepository } from '../repositories/pts-goals.repository';
import { PtsReassessmentRepository } from '../repositories/pts-reassessment.repository';

/** Reavaliação do fim do ciclo (RFEVA005). */
@Injectable()
export class PtsReassessmentService {
  constructor(
    private readonly goalsRepository: PtsGoalsRepository,
    private readonly reassessmentRepository: PtsReassessmentRepository,
  ) {}

  async registerReassessment(
    ptsId: string,
    dto: RegisterReassessmentRequestDto,
    account: AccountContext,
  ): Promise<RegisterReassessmentResponseDto> {
    const pts = await this.goalsRepository.findPtsTarget(ptsId);

    if (!pts) {
      throw ptsNotFound();
    }

    const admin = isAdmin(account);

    // Só o responsável (ou o admin, RN022).
    if (
      !admin &&
      !account.professionalProfileIds.includes(pts.responsibleProfessionalId)
    ) {
      throw reassessmentForbidden();
    }

    if (pts.status !== PtsStateEnum.RUNNING) {
      throw reassessmentNotRunning();
    }

    assertGoalsAssessed(await this.goalsRepository.findByPts(ptsId), dto.goals);

    const name =
      (await this.goalsRepository.findAccountDisplayName(account.accountId)) ??
      (admin ? 'Administrador' : 'Profissional responsável');

    return this.reassessmentRepository.register({
      ptsId,
      meetingDate: dto.meetingDate,
      goals: dto.goals.map(({ goalId, status, note }) => ({
        goalId,
        status,
        note: note?.trim() || null,
      })),
      createNextVersion: dto.createNextVersion,
      reason: dto.reason?.trim() || null,
      actor: {
        accountId: account.accountId,
        // Admin não tem perfil profissional: sem autor nos eventos (RN029).
        professionalId: admin ? null : pts.responsibleProfessionalId,
        name,
      },
    });
  }
}
