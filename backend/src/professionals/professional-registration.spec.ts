import { describe, expect, it } from '@jest/globals';
import { Specialism } from './enums/specialism.enum';
import {
  COUNCILS,
  SPECIALISM_COUNCILS,
  SPECIALISM_NAMES,
  specialismsOfCouncils,
  toProfessionalRegistration,
} from './professional-registration';

describe('toProfessionalRegistration', () => {
  it('takes the council from the specialism', () => {
    expect(
      toProfessionalRegistration(Specialism.Psychologist, '12345', 'pr'),
    ).toEqual({ council: 'CRP', number: '12345', state: 'pr' });
    expect(
      toProfessionalRegistration(Specialism.Physiotherapist, '54321', 'sp'),
    ).toEqual({ council: 'Crefito', number: '54321', state: 'sp' });
  });

  it('returns null without number or state', () => {
    expect(
      toProfessionalRegistration(Specialism.Doctor, null, 'pr'),
    ).toBeNull();
    expect(toProfessionalRegistration(Specialism.Doctor, '1', null)).toBeNull();
  });
});

describe('especialidades', () => {
  const specialisms = Object.values(Specialism);

  it('tem as 20 especialidades da lista fixa', () => {
    expect(specialisms).toHaveLength(20);
  });

  it.each(specialisms)('%s tem conselho e nome exibido', (specialism) => {
    expect(SPECIALISM_COUNCILS[specialism]).toBeTruthy();
    expect(SPECIALISM_NAMES[specialism]).toBeTruthy();
  });

  it('só usa conselhos da lista COUNCILS', () => {
    for (const specialism of specialisms) {
      expect(COUNCILS).toContain(SPECIALISM_COUNCILS[specialism]);
    }
  });

  it.each([
    [Specialism.SpeechTherapist, 'CRFa', 'Fonoaudiólogo'],
    [Specialism.Neuropsychologist, 'CRP', 'Neuropsicólogo'],
    [Specialism.OccupationalTherapist, 'Crefito', 'Terapeuta ocupacional'],
    [Specialism.PediatricDentist, 'CRO', 'Odontopediatra'],
  ])('%s: %s, %s', (specialism, council, name) => {
    expect(SPECIALISM_COUNCILS[specialism]).toBe(council);
    expect(SPECIALISM_NAMES[specialism]).toBe(name);
  });

  it('filtra as especialidades por conselho', () => {
    expect(specialismsOfCouncils(['Crefito'])).toEqual([
      Specialism.Physiotherapist,
      Specialism.OccupationalTherapist,
    ]);
  });
});
