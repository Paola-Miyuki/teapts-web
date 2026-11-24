'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import Icon from '@/components/Icon';

type KebabMenuProps = {
  label: string;
  children: React.ReactNode;
};

// Menu ⋮ das linhas da tabela, como nos mockups: abre fixo junto do botão
// (acima dele quando não cabe embaixo) e fecha com clique fora, Esc ou ao
// escolher uma ação.
export default function KebabMenu({ label, children }: KebabMenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  useLayoutEffect(() => {
    const button = buttonRef.current;
    const menu = menuRef.current;

    if (!open || !button || !menu) {
      return;
    }

    const rect = button.getBoundingClientRect();
    const top =
      rect.bottom + menu.offsetHeight + 8 > window.innerHeight
        ? Math.max(8, rect.top - menu.offsetHeight - 4)
        : rect.bottom + 4;
    menu.style.top = `${top}px`;
    menu.style.left = `${Math.max(8, rect.right - menu.offsetWidth)}px`;
    menu.querySelector<HTMLElement>('a, button')?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function close(event: Event) {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !menuRef.current?.contains(event.target as Node) &&
            !buttonRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    window.addEventListener('scroll', () => setOpen(false), { once: true });

    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="kebab-btn icon-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="more" className="icon" />
      </button>

      <ul
        ref={menuRef}
        className="kebab-menu"
        role="menu"
        hidden={!open}
        onClick={() => setOpen(false)}
      >
        {children}
      </ul>
    </>
  );
}
