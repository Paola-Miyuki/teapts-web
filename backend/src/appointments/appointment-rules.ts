import { ActivityState } from '../activities/enums/activity.enums';
import { PtsStateEnum } from '../database/enums/pts-state.enum';
import {
  activityNotRunning,
  appointmentPtsNotActive,
} from './appointments.errors';

/** Só a atividade em andamento, de um PTS ativo, recebe atendimento (RFACT004). */
export function assertReceivesAppointment(
  ptsStatus: PtsStateEnum,
  activityStatus: ActivityState,
): void {
  if (activityStatus !== ActivityState.Running) {
    throw activityNotRunning();
  }

  if (![PtsStateEnum.PLANNING, PtsStateEnum.RUNNING].includes(ptsStatus)) {
    throw appointmentPtsNotActive();
  }
}
