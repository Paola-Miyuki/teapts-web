import { describe, expect, it } from '@jest/globals';
import { Specialism } from './enums/specialism.enum';
import { toProfessionalRegistration } from './professional-registration';

describe('toProfessionalRegistration', () => {
  it('takes the council from the specialism', () => {
    expect(
      toProfessionalRegistration(Specialism.Psychologist, '12345', 'PR'),
    ).toEqual({ council: 'CRP', number: '12345', state: 'PR' });
    expect(
      toProfessionalRegistration(Specialism.Physiotherapist, '54321', 'SP'),
    ).toEqual({ council: 'Crefito', number: '54321', state: 'SP' });
  });

  it('returns null without number or state', () => {
    expect(
      toProfessionalRegistration(Specialism.Doctor, null, 'PR'),
    ).toBeNull();
    expect(toProfessionalRegistration(Specialism.Doctor, '1', null)).toBeNull();
  });
});
