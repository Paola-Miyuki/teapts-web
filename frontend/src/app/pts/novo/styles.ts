export const labelCls = 'block text-[12px] font-semibold text-slate-900';
export const fieldCls = 'flex flex-col gap-2';
export const helpCls = 'text-[11px] leading-4 text-slate-500';
export const fieldErrorCls = 'text-[12px] leading-4 text-[#b45309]';

const inputBase =
  'w-full rounded-xl px-[15px] text-[14px] text-slate-900 placeholder:text-slate-500 focus:outline-2 focus:outline-offset-2 transition-colors disabled:opacity-60';
const inputOk =
  'bg-white border border-[#ddddda] focus:outline-slate-900 focus:border-slate-900';
const inputInvalid =
  'bg-[#fffbeb] border border-[#d97706] focus:outline-[#d97706]';

export const inputCls = (invalid?: boolean) =>
  `${inputBase} h-[46px] py-2.5 ${invalid ? inputInvalid : inputOk}`;
export const textareaCls = (invalid?: boolean) =>
  `${inputBase} min-h-[134px] py-3 resize-y ${invalid ? inputInvalid : inputOk}`;

export const alertCls =
  'p-3 text-[13px] leading-relaxed text-[#92400e] bg-[#fffbeb] border border-[#f1d48a] rounded-lg shadow-sm focus:outline-none';

export const primaryBtnCls =
  'inline-flex h-[46px] items-center justify-center gap-2 rounded-xl border border-[#e8bb2f] bg-[#e8bb2f] px-6 text-[14px] font-semibold text-slate-900 transition-colors hover:brightness-105 disabled:opacity-50';
export const secondaryBtnCls =
  'inline-flex h-[46px] items-center justify-center rounded-xl border border-[#ddddda] bg-white px-6 text-[14px] font-semibold text-slate-800 transition-colors hover:bg-[#fafaf9]';
