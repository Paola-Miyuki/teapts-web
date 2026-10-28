import ui from '@/components/ui.module.css';
import styles from './novo.module.css';

// Atalhos para o visual padrão (ui.module.css). O estado inválido vem do
// aria-invalid, que o ui.module.css já estiliza; o argumento é mantido
// só para não quebrar quem ainda chama inputCls(!!error).
export const labelCls = ui.label;
export const fieldCls = ui.field;
export const helpCls = ui.hint;
export const fieldErrorCls = ui.fieldError;
export const alertCls = ui.alert;

export const inputCls = (invalid?: boolean) => {
  void invalid;
  return ui.input;
};

export const textareaCls = (invalid?: boolean) => {
  void invalid;
  return `${ui.input} ${styles.textarea}`;
};

export const primaryBtnCls = `${ui.btn} ${ui.btnPrimary}`;
export const secondaryBtnCls = `${ui.btn} ${ui.btnSecondary}`;
