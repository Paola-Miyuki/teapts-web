import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdatePtsProposalRequestDto } from '../dto/update-pts-proposal.dto';

describe('UpdatePtsProposalRequestDto', () => {
  it.each([
    ['socialSituation nula', { socialSituation: null }],
    ['teamProfessionalIds nulo', { teamProfessionalIds: null }],
  ])('rejeita %s', async (_name, payload) => {
    const dto = plainToInstance(UpdatePtsProposalRequestDto, payload);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
