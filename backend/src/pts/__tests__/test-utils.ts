import { HttpException } from '@nestjs/common';

/** Garante que a promise/função falha com o HTTP status e o código `status` do contrato. */
export async function expectApiError(
  run: () => unknown,
  httpStatus: number,
  code: string,
) {
  let error: unknown = null;
  try {
    await run();
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(HttpException);
  const ex = error as HttpException;
  expect(ex.getStatus()).toBe(httpStatus);
  expect(ex.getResponse()).toMatchObject({ status: code });
  return ex.getResponse() as Record<string, unknown>;
}
