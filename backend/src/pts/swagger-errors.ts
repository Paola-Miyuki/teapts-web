import { ErrorResponseDto } from '../common/swagger/error-response.dto';
import type { PtsApiError } from './pts.errors';

// Os exemplos do Swagger saem dos próprios erros da API.
export function errors(...items: PtsApiError[]) {
  return {
    type: ErrorResponseDto,
    examples: Object.fromEntries(
      items.map((error) => {
        const { status, message } = error.getResponse() as {
          status: string;
          message: string;
        };

        return [status, { summary: message, value: { status, message } }];
      }),
    ),
  };
}
