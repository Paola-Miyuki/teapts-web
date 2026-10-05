<<<<<<< HEAD
"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";

export default function CadastroPage() {
  // Estados do formulário
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Estados de interface
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name || !email || !password || !confirmPassword) {
      setError("Preencha os campos obrigatórios antes de continuar.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:3000/accounts/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Ocorreu um erro ao criar a conta.");
      }

      window.location.href = "/login?registered=true";
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Erro ao conectar com o servidor.");
      }
    } finally {
      setIsLoading(false);
    }
  };
=======
import Image from 'next/image';
>>>>>>> 1f9d3db45f2a4fc0cefc560fa63688ce4b437ca6

  return (
<<<<<<< HEAD
    <div className="min-h-screen bg-[#F8F9FA] text-slate-800 flex items-center justify-center p-4 md:p-8 lg:p-12">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* Painel Esquerdo: Cartão de Apresentação */}
        <section className="lg:col-span-5 bg-white rounded-[28px] border border-slate-200/80 p-8 md:p-12 flex flex-col justify-between shadow-sm min-h-[580px]">
          {/* Logo e Marca */}
          <div>
            <Link href="/" className="inline-flex items-center gap-3 text-slate-900 font-bold tracking-tight text-xl mb-16">
              {/* Símbolo do Infinito / TEA-PTS */}
              <svg className="w-9 h-9" viewBox="0 0 100 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M25 10C15 10 7 17 7 25C7 33 15 40 25 40C35 40 43 32 50 25C57 18 65 10 75 10C85 10 93 17 93 25C93 33 85 40 75 40C65 40 57 32 50 25C43 18 35 10 25 10Z"
                  stroke="url(#gradient-infinity)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <defs>
                  <linearGradient id="gradient-infinity" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#D97706" />
                    <stop offset="50%" stopColor="#2563EB" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="font-sans text-lg tracking-wider font-extrabold text-slate-900">TEA-PTS</span>
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
                Crie sua conta para participar da construção do seu Programa Terapêutico Singular.
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
          <div className="w-full max-w-md mx-auto space-y-6">
            
            {/* Link de Retorno */}
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5m7 7-7-7 7-7"/>
              </svg>
              Voltar ao login
            </Link>

            {/* Cabeçalho do Formulário */}
            <div>
              <h2 className="font-serif text-3xl font-normal text-slate-900">Crie sua conta</h2>
              <p className="text-slate-500 text-xs mt-1">Preencha seus dados para começar.</p>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              
              {/* Alerta de Erro / Mensagem */}
              {error && (
                <div className="p-3 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg shadow-sm" role="alert">
                  {error}
                </div>
              )}

              {/* Campo: Nome Completo */}
              <div className="space-y-1">
                <label htmlFor="name" className="block text-xs font-medium text-slate-700">
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
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                />
              </div>

              {/* Campo: E-mail */}
              <div className="space-y-1">
                <label htmlFor="email" className="block text-xs font-medium text-slate-700">
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
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                />
              </div>

              {/* Campo: Criar Senha */}
              <div className="space-y-1">
                <label htmlFor="password" className="block text-xs font-medium text-slate-700">
                  Criar senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Crie uma senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z"/>
                      <circle cx="12" cy="12" r="2.5"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Campo: Repita a Senha */}
              <div className="space-y-1">
                <label htmlFor="confirm-password" className="block text-xs font-medium text-slate-700">
                  Repita a senha
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    name="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    placeholder="Digite sua senha novamente"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Ocultar confirmação da senha" : "Mostrar confirmação da senha"}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z"/>
                      <circle cx="12" cy="12" r="2.5"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Botão de Envio */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 bg-[#FFC107] hover:bg-[#FFB300] active:bg-[#FFA000] text-slate-900 font-medium rounded-lg text-xs transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isLoading ? "Criando conta..." : "Criar conta"}
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14m-7-7 7 7-7 7"/>
                </svg>
              </button>
            </form>

            {/* Rodapé e Links */}
            <div className="pt-2 text-center space-y-4">
              <p className="text-xs text-slate-600">
                Já tem uma conta?{" "}
                <Link href="/login" className="font-semibold text-slate-900 hover:underline">
                  Fazer login
                </Link>
              </p>

              <p className="text-[11px] text-slate-400">
                Protótipo interativo · nenhum dado é enviado ao servidor
              </p>
            </div>

          </div>
        </section>

      </div>
=======
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert h-5 w-[100px]"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            To get started, edit the{' '}
            <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">
              page.tsx
            </code>{' '}
            file.
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Looking for a starting point or more instructions? Head over to{' '}
            <a
              href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Templates
            </a>{' '}
            or the{' '}
            <a
              href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Learning
            </a>{' '}
            center.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert h-[14px] w-4"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={16}
              height={14}
            />
            Deploy Now
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </a>
        </div>
      </main>
>>>>>>> 1f9d3db45f2a4fc0cefc560fa63688ce4b437ca6
    </div>
  );
}