import { AccountRole } from '../../accounts/enums/account-role.enum';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import type { CreateGoalRequestDto } from '../dto/create-goal.dto';
import {
  GoalArea,
  GoalOrigin,
  GoalStatus,
  GoalTerm,
} from '../enums/goal.enums';
import { InMemoryPtsGoalsRepository } from './in-memory-pts-goals.repository';

export const goalBody = (): CreateGoalRequestDto => ({
  title: 'Conversa curta com um colega',
  description: 'Iniciar e manter uma conversa de 3 turnos com um colega.',
  term: GoalTerm.Short,
  area: GoalArea.Social,
  measureCriterion: '3 conversas por semana registradas pela escola',
  targetDate: '2027-02-28',
});

export const accountOf = (
  overrides: Partial<AccountContext> = {},
): AccountContext => ({
  accountId: 'acc-1',
  role: AccountRole.User,
  patientProfileId: null,
  professionalProfileIds: [],
  ...overrides,
});

export const responsible = accountOf({ professionalProfileIds: ['prof-1'] });
export const member = accountOf({
  accountId: 'acc-2',
  professionalProfileIds: ['prof-2'],
});
export const outsider = accountOf({
  accountId: 'acc-9',
  professionalProfileIds: ['prof-9'],
});
export const patient = accountOf({
  accountId: 'patient-1',
  patientProfileId: 'patient-1',
});
export const admin = accountOf({
  accountId: 'acc-admin',
  role: AccountRole.Admin,
});

export function storedGoal(id: string, activitiesCount = 0) {
  return {
    id,
    title: 'Conversa curta com um colega',
    description: 'Iniciar e manter uma conversa de 3 turnos com um colega.',
    term: GoalTerm.Short,
    area: GoalArea.Social,
    measureCriterion: '3 conversas por semana registradas pela escola',
    targetDate: '2027-02-28',
    status: GoalStatus.InProgress,
    resultNote: null,
    origin: GoalOrigin.New,
    activitiesCount,
    registeredBy: { id: 'acc-1', name: 'Ana Souza' },
    createdAt: '2026-11-20T12:00:00.000Z',
    ptsId: 'pts-1',
    deleted: false,
  };
}

export function seededGoalsRepo(status = PtsStateEnum.RUNNING) {
  const repo = new InMemoryPtsGoalsRepository();
  repo.pts.push({
    id: 'pts-1',
    status,
    patientId: 'patient-1',
    responsibleProfessionalId: 'prof-1',
    teamProfessionalIds: ['prof-2'],
    nextReviewAt: '2027-03-31',
  });
  repo.accountNames.set('acc-1', 'Ana Souza');
  repo.accountNames.set('acc-2', 'João Lima');
  repo.accountNames.set('acc-admin', 'Kaio');
  repo.goals.push(storedGoal('goal-1'), storedGoal('goal-2'));

  return repo;
}
