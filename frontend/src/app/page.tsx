'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import EmailPassword from 'supertokens-web-js/recipe/emailpassword';

import Logo from '@/components/Logo';
import { initSuperTokens } from '@/lib/supertokens';

function translateSignupError(message: string) {
  if (/at least 8 characters.*including a number/i.test(message)) {
    return 'A senha precisa ter pelo menos 8 caracteres e conter um número.';
  }

  if (/at least 8 characters/i.test(message)) {
    return 'A senha deve ter pelo menos 8 caracteres.';
  }

  if (/including a number|contain.*number|number/i.test(message)) {
    return 'A senha deve conter pelo menos um número.';
  }

  if (/email.*already exists|email.*already registered/i.test(message)) {
    return 'Este e-mail já está cadastrado.';
  }

  if (/invalid email|valid email/i.test(message)) {
    return 'Informe um e-mail válido.';
  }

  return 'Não foi possível concluir o cadastro. Verifique os dados informados.';
}

export default function CadastroPage() {
  const router = useRouter();
  useEffect(() => {
    initSuperTokens();
  }, []);
  // Estados do formulário
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Estados de interface
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const passwordHasMinLength = password.length >= 8;
  const passwordHasNumber = /\d/.test(password);
  const passwordIsInvalid =
    (password.length > 0 || hasSubmitted) &&
    (!passwordHasMinLength || !passwordHasNumber);
  const confirmPasswordIsInvalid =
    (confirmPassword.length > 0 || hasSubmitted) &&
    (!confirmPassword || password !== confirmPassword);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setHasSubmitted(true);
    setError(null);

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Preencha os campos obrigatórios antes de continuar.');
      return;
    }

    if (!passwordHasMinLength || !passwordHasNumber) {
      setError(
        'A senha precisa ter pelo menos 8 caracteres e conter um número.',
      );
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await EmailPassword.signUp({
        formFields: [
          { id: 'name', value: name.trim() },
          { id: 'email', value: email.trim() },
          { id: 'password', value: password },
        ],
      });

      if (response.status === 'OK') {
        router.push('/login?registered=true');
        return;
      }

      if (response.status === 'FIELD_ERROR') {
        setError(
          response.formFields
            .map((field) => translateSignupError(field.error))
            .join(' '),
        );
        return;
      }

      setError('Não foi possível concluir o cadastro.');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(translateSignupError(err.message));
      } else {
        setError('Erro ao conectar com o servidor.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-800 flex items-center justify-center p-4 md:p-8 lg:p-12">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Painel Esquerdo: Cartão de Apresentação */}
        <section className="lg:col-span-5 bg-white rounded-[28px] border border-slate-200/80 p-8 md:p-12 flex flex-col justify-between shadow-sm min-h-[580px]">
          {/* Logo e Marca */}
          <div>
            <Link
              href="/"
              className="inline-flex text-slate-900 font-bold tracking-tight text-xl mb-16"
            >
              <Logo />
            </Link>

            {/* Conteúdo Principal do Cartão */}
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Um novo começo no cuidado
              </p>
              <h1 className="font-serif text-4xl md:text-5xl font-normal leading-[1.15] text-slate-900">
                Seu cuidado começa com uma conexão.
              </h1>
              <p className="text-slate-500 text-sm leading-relaxed pt-2 max-w-sm">
                Crie sua conta para participar da construção do seu Programa
                Terapêutico Singular.
              </p>
            </div>
          </div>

          {/* Rodapé do Cartão */}
          <div className="text-slate-400 text-xs leading-relaxed mt-12">
            <p>Pacientes e profissionais.</p>
            <p>Uma visão compartilhada do cuidado.</p>
          </div>
        </section>

        {/* Painel Direito: Formulário */}
        <section className="lg:col-span-7 flex flex-col justify-center px-4 lg:px-12 py-4">
          <div className="w-full max-w-[480px] mx-auto space-y-7">
            {/* Link de Retorno */}
            <Link
              href="/login"
              className="inline-flex min-h-[44px] items-center gap-2 text-[14px] font-medium text-slate-700 hover:text-slate-900 transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5m7 7-7-7 7-7" />
              </svg>
              Voltar ao login
            </Link>

            {/* Cabeçalho do Formulário */}
            <div>
              <h2 className="font-serif text-4xl font-normal leading-[1.2] text-slate-900">
                Crie sua conta
              </h2>
              <p className="text-slate-500 text-[15px] leading-[1.6] mt-4 mb-2">
                Preencha seus dados para começar.
              </p>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {/* Alerta de Erro / Mensagem */}
              {error && (
                <div
                  className="p-3 text-[13px] leading-relaxed text-[#92400e] bg-[#fffbeb] border border-[#f1d48a] rounded-lg shadow-sm"
                  role="alert"
                >
                  {error}
                </div>
              )}

              {/* Campo: Nome Completo */}
              <div className="flex flex-col gap-[9px]">
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-slate-700"
                >
                  Nome completo
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="Digite seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-[52px] px-[17px] py-3 bg-white border border-[#ddddda] rounded-xl text-[15px] text-slate-900 placeholder:text-[#777777] focus:outline-2 focus:outline-slate-900 focus:outline-offset-2 focus:border-slate-900 transition-colors"
                />
              </div>

              {/* Campo: E-mail */}
              <div className="flex flex-col gap-[9px]">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-700"
                >
                  E-mail
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="Digite seu e-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-[52px] px-[17px] py-3 bg-white border border-[#ddddda] rounded-xl text-[15px] text-slate-900 placeholder:text-[#777777] focus:outline-2 focus:outline-slate-900 focus:outline-offset-2 focus:border-slate-900 transition-colors"
                />
              </div>

              {/* Campo: Criar Senha */}
              <div className="flex flex-col gap-[9px]">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700"
                >
                  Criar senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Crie uma senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full h-[52px] px-[17px] py-3 pr-[52px] bg-white rounded-xl text-[15px] text-slate-900 placeholder:text-[#777777] focus:outline-2 focus:outline-offset-2 transition-colors ${
                      passwordIsInvalid
                        ? 'border border-[#d97706] bg-[#fffbeb] focus:outline-[#d97706]'
                        : 'border border-[#ddddda] focus:outline-slate-900 focus:border-slate-900'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword ? 'Ocultar senha' : 'Mostrar senha'
                    }
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z" />
                      <circle cx="12" cy="12" r="2.5" />
                    </svg>
                  </button>
                </div>
                <div className="rounded-lg border border-[#ddddda] bg-[#fafaf9] px-3 py-2.5 text-[12px] leading-5 text-slate-600">
                  <p className="mb-1.5 font-medium text-slate-700">
                    Requisitos da senha
                  </p>
                  <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2 sm:gap-x-4">
                    <p
                      className={
                        passwordHasMinLength
                          ? 'text-emerald-700'
                          : password.length > 0
                            ? 'text-[#b45309]'
                            : 'text-slate-500'
                      }
                    >
                      <span aria-hidden="true">
                        {passwordHasMinLength ? '✓' : '•'}
                      </span>{' '}
                      Oito caracteres ou mais
                    </p>
                    <p
                      className={
                        passwordHasNumber
                          ? 'text-emerald-700'
                          : password.length > 0
                            ? 'text-[#b45309]'
                            : 'text-slate-500'
                      }
                    >
                      <span aria-hidden="true">
                        {passwordHasNumber ? '✓' : '•'}
                      </span>{' '}
                      Pelo menos um número
                    </p>
                  </div>
                </div>
              </div>

              {/* Campo: Repita a Senha */}
              <div className="flex flex-col gap-[9px]">
                <label
                  htmlFor="confirm-password"
                  className="block text-sm font-medium text-slate-700"
                >
                  Repita a senha
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    name="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="Digite sua senha novamente"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full h-[52px] px-[17px] py-3 pr-[52px] bg-white rounded-xl text-[15px] text-slate-900 placeholder:text-[#777777] focus:outline-2 focus:outline-offset-2 transition-colors ${
                      confirmPasswordIsInvalid
                        ? 'border border-[#d97706] bg-[#fffbeb] focus:outline-[#d97706]'
                        : 'border border-[#ddddda] focus:outline-slate-900 focus:border-slate-900'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={
                      showConfirmPassword
                        ? 'Ocultar confirmação da senha'
                        : 'Mostrar confirmação da senha'
                    }
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z" />
                      <circle cx="12" cy="12" r="2.5" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Botão de Envio */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[52px] mt-2 border border-[#e8bb2f] bg-[#e8bb2f] hover:brightness-105 text-slate-900 font-semibold rounded-xl text-[15px] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? 'Criando conta...' : 'Criar conta'}
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14m-7-7 7 7-7 7" />
                </svg>
              </button>
            </form>

            {/* Rodapé e Links */}
            <div className="pt-2 text-center">
              <p className="min-h-[44px] flex items-center justify-center gap-1 text-[14px] text-slate-600">
                Já tem uma conta?
                <Link
                  href="/login"
                  className="min-h-[44px] inline-flex items-center font-semibold text-[14px] text-slate-900 hover:underline"
                >
                  Fazer login
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
