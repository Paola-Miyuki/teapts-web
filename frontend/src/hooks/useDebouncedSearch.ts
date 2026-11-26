'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type UseDebouncedSearchOptions = {
  initialTerm?: string;
  delay?: number;
  minLength?: number;
  // Chamado só quando o termo efetivo muda (ex.: para gravar na URL).
  onTermChange?: (term: string) => void;
};

// Busca por texto das listagens e dos campos de seleção (NFUS003): o termo
// efetivo vale depois do debounce, tem os espaços externos removidos e no
// mínimo `minLength` caracteres; campo vazio volta à lista completa.
// Termo curto demais não muda o termo efetivo.
export function useDebouncedSearch({
  initialTerm = '',
  delay = 300,
  minLength = 2,
  onTermChange,
}: UseDebouncedSearchOptions = {}) {
  const [input, setInput] = useState(initialTerm);
  const [term, setTerm] = useState(() => {
    const trimmed = initialTerm.trim();

    return trimmed.length >= minLength ? trimmed : '';
  });

  const termRef = useRef(term);
  const onTermChangeRef = useRef(onTermChange);

  useEffect(() => {
    onTermChangeRef.current = onTermChange;
  });

  const applyTerm = useCallback(
    (value: string) => {
      const trimmed = value.trim();

      if (trimmed !== '' && trimmed.length < minLength) {
        return;
      }

      if (trimmed === termRef.current) {
        return;
      }

      termRef.current = trimmed;
      setTerm(trimmed);
      onTermChangeRef.current?.(trimmed);
    },
    [minLength],
  );

  useEffect(() => {
    const timer = setTimeout(() => applyTerm(input), delay);

    return () => clearTimeout(timer);
  }, [applyTerm, delay, input]);

  // Enter: busca na hora, sem esperar o debounce.
  const commit = useCallback(() => applyTerm(input), [applyTerm, input]);

  const clear = useCallback(() => {
    setInput('');
    applyTerm('');
  }, [applyTerm]);

  const trimmedInput = input.trim();

  return {
    input,
    setInput,
    term,
    commit,
    clear,
    isTooShort: trimmedInput !== '' && trimmedInput.length < minLength,
  };
}
