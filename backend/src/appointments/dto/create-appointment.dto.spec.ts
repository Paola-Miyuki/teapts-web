import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  absenceBody,
  appointmentBody,
} from '../__tests__/appointment-fixtures';
import { CreateAppointmentRequestDto } from './create-appointment.dto';

async function invalidFields(body: object) {
  const errors = await validate(
    plainToInstance(CreateAppointmentRequestDto, body),
  );

  return errors.map(({ property }) => property);
}

describe('CreateAppointmentRequestDto', () => {
  it('aceita o realizado completo e a falta sem SOAP', async () => {
    expect(await invalidFields(appointmentBody())).toEqual([]);
    expect(await invalidFields(absenceBody())).toEqual([]);
  });

  it.each([
    ['appointmentDate', '2026-02-30'],
    ['appointmentDate', '03/12/2026'],
    ['startTime', '24:00'],
    ['startTime', '9:00'],
    ['endTime', '14:60'],
    ['modality', 'phone'],
    ['attendance', 'late'],
    ['visitPlace', 'park'],
    ['authorProfessionalId', 'x'],
    ['absenceReason', 1],
    ['soapPlan', '   '],
    ['soapSubjective', undefined],
    ['endTime', undefined],
  ])('recusa %s = %s', async (field, value) => {
    expect(
      await invalidFields({ ...appointmentBody(), [field]: value }),
    ).toEqual([field]);
  });

  it('exige o local na visita externa', async () => {
    expect(
      await invalidFields({ ...absenceBody(), modality: 'external_visit' }),
    ).toEqual(['visitPlace']);
  });
});
