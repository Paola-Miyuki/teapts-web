import { Specialism } from '../../professionals/enums/specialism.enum';
import type { ActivityResponseDto } from '../dto/activity-response.dto';
import type { CreateActivityRequestDto } from '../dto/create-activity.dto';
import {
  ActivityModality,
  ActivityPeriod,
  ActivityState,
  ActivityType,
} from '../enums/activity.enums';
import {
  ActivitiesRepository,
  type CreateActivityInput,
} from '../repositories/activities.repository';

export const activityBody = (): CreateActivityRequestDto => ({
  title: 'Integração sensorial',
  description: 'Circuito sensorial com estímulo tátil e vestibular.',
  type: ActivityType.IndividualSession,
  specialism: Specialism.OccupationalTherapist,
  frequency: {
    quantity: 1,
    period: ActivityPeriod.Weekly,
    durationMinutes: 45,
  },
  modality: ActivityModality.InPerson,
});

export class InMemoryActivitiesRepository extends ActivitiesRepository {
  created: CreateActivityInput[] = [];
  activities: ActivityResponseDto[] = [];
  documents: { id: string; patientId: string }[] = [];

  async findPatientDocumentIds(
    patientId: string,
    ids: string[],
  ): Promise<string[]> {
    return this.documents
      .filter((item) => item.patientId === patientId && ids.includes(item.id))
      .map((item) => item.id);
  }

  async findByPts(): Promise<ActivityResponseDto[]> {
    return this.activities;
  }

  async create(input: CreateActivityInput): Promise<ActivityResponseDto> {
    this.created.push(input);
    const activity: ActivityResponseDto = {
      id: `66666666-6666-4666-8666-66666666666${this.activities.length}`,
      ...input.values,
      executorProfessionalIds: input.executorProfessionalIds,
      documentIds: input.documentIds,
      status: ActivityState.Suggested,
      createdAt: '2026-12-01T13:00:00.000Z',
    };
    this.activities.push(activity);

    return activity;
  }
}
