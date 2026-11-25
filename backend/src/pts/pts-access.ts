import type { AccountContext } from '../accounts/services/accounts.service';
import { isAdmin } from '../auth/account-context';
import { PtsStateEnum } from '../database/enums/pts-state.enum';
import { ptsForbidden } from './pts.errors';
import type { GoalPtsTarget } from './repositories/pts-goals.repository';

export function teamIds(pts: GoalPtsTarget): string[] {
  return [pts.responsibleProfessionalId, ...pts.teamProfessionalIds];
}

export function ownTeamProfile(
  pts: GoalPtsTarget,
  account: AccountContext,
): string | undefined {
  return teamIds(pts).find((id) => account.professionalProfileIds.includes(id));
}

/** Admin, paciente titular ou equipe, que não abre PTS rejeitado (RN016). */
export function assertCanViewPts(
  pts: GoalPtsTarget,
  account: AccountContext,
): void {
  const isPatientOwner =
    account.patientProfileId !== null &&
    account.patientProfileId === pts.patientId;
  const isTeam =
    pts.status !== PtsStateEnum.REJECTED &&
    ownTeamProfile(pts, account) !== undefined;

  if (!isAdmin(account) && !isPatientOwner && !isTeam) {
    throw ptsForbidden();
  }
}
