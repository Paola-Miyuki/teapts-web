import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdatePtsProposalRequestDto } from '../dto/update-pts-proposal.dto';

describe('UpdatePtsProposalRequestDto', () => {
  it.each([
    ['socialSituation nula', { socialSituation: null }],
    ['diagnosisSummary vazio', { diagnosisSummary: ' ' }],
    ['nextReviewAt inválida', { nextReviewAt: '2027-02-30' }],
    ['nextReviewAt nula', { nextReviewAt: null }],
    ['supportLevel 4', { supportLevel: 4 }],
    ['teamProfessionalIds nulo', { teamProfessionalIds: null }],
  ])('rejeita %s', async (_name, payload) => {
    const dto = plainToInstance(UpdatePtsProposalRequestDto, payload);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('aceita só parte da ficha, com opcional nulo', async () => {
    const dto = plainToInstance(UpdatePtsProposalRequestDto, {
      cid: null,
      supportLevel: null,
      nextReviewAt: '2027-12-15',
    });

    expect(await validate(dto)).toEqual([]);
  });
});
