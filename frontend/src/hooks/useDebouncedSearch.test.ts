import { act, renderHook } from '@testing-library/react';

import { useDebouncedSearch } from './useDebouncedSearch';

describe('useDebouncedSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('começa com o termo inicial já aplicado', () => {
    const { result } = renderHook(() =>
      useDebouncedSearch({ initialTerm: ' maria ' }),
    );

    expect(result.current.input).toBe(' maria ');
    expect(result.current.term).toBe('maria');
  });

  it('só aplica o termo 300 ms depois da última tecla', () => {
    const { result } = renderHook(() => useDebouncedSearch());

    act(() => result.current.setInput('ma'));
    act(() => jest.advanceTimersByTime(299));

    expect(result.current.term).toBe('');

    act(() => result.current.setInput('mar'));
    act(() => jest.advanceTimersByTime(299));

    expect(result.current.term).toBe('');

    act(() => jest.advanceTimersByTime(1));

    expect(result.current.term).toBe('mar');
  });

  it('remove os espaços externos do termo', () => {
    const { result } = renderHook(() => useDebouncedSearch());

    act(() => result.current.setInput('  ana  '));
    act(() => jest.advanceTimersByTime(300));

    expect(result.current.term).toBe('ana');
  });

  it('ignora o termo com menos de 2 caracteres e mantém o anterior', () => {
    const { result } = renderHook(() =>
      useDebouncedSearch({ initialTerm: 'maria' }),
    );

    act(() => result.current.setInput('m'));
    act(() => jest.advanceTimersByTime(300));

    expect(result.current.term).toBe('maria');
    expect(result.current.isTooShort).toBe(true);
  });

  it('volta à lista completa quando o campo fica vazio', () => {
    const { result } = renderHook(() =>
      useDebouncedSearch({ initialTerm: 'maria' }),
    );

    act(() => result.current.setInput('   '));
    act(() => jest.advanceTimersByTime(300));

    expect(result.current.term).toBe('');
    expect(result.current.isTooShort).toBe(false);
  });

  it('aplica na hora com commit (Enter)', () => {
    const { result } = renderHook(() => useDebouncedSearch());

    act(() => result.current.setInput('joão'));
    act(() => result.current.commit());

    expect(result.current.term).toBe('joão');
  });

  it('limpa o campo e o termo na hora', () => {
    const { result } = renderHook(() =>
      useDebouncedSearch({ initialTerm: 'maria' }),
    );

    act(() => result.current.clear());

    expect(result.current.input).toBe('');
    expect(result.current.term).toBe('');
  });

  it('avisa só quando o termo efetivo muda', () => {
    const onTermChange = jest.fn();
    const { result } = renderHook(() => useDebouncedSearch({ onTermChange }));

    act(() => result.current.setInput('ana'));
    act(() => jest.advanceTimersByTime(300));

    expect(onTermChange).toHaveBeenCalledTimes(1);
    expect(onTermChange).toHaveBeenCalledWith('ana');

    act(() => result.current.setInput(' ana '));
    act(() => jest.advanceTimersByTime(300));

    expect(onTermChange).toHaveBeenCalledTimes(1);

    act(() => result.current.clear());

    expect(onTermChange).toHaveBeenCalledTimes(2);
    expect(onTermChange).toHaveBeenLastCalledWith('');
  });
});
