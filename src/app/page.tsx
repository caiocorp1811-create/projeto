"use client";

import { signIn, signOut } from "next-auth/react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import styles from "./page.module.css";

type Summary = Record<string, unknown>;
type ImportRow = { id: string; arquivo: string; enviado_em: string; resumo: Summary | null };

export default function Home() {
  const [logged, setLogged] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [result, setResult] = useState<Summary | null>(null);
  const [history, setHistory] = useState<ImportRow[]>([]);

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/imports");
    if (res.ok) setHistory((await res.json()).importacoes);
  }, []);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        const ok = Boolean(s?.user);
        setLogged(ok);
        if (ok) void loadHistory();
      })
      .catch(() => setLogged(false));
  }, [loadHistory]);

  async function onLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });
    setBusy(false);
    if (res?.error) return setError("E-mail ou senha incorretos.");
    setLogged(true);
    void loadHistory();
  }

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setResult(null);
    setBusy(true);
    try {
      const res = await fetch("/api/imports", { method: "POST", body: new FormData(e.currentTarget) });
      const data = await res.json();
      if (!res.ok) setError(data.erro ?? "Falha no envio.");
      else {
        setResult(data);
        void loadHistory();
      }
    } catch {
      setError("Não foi possível enviar o arquivo.");
    }
    setBusy(false);
  }

  if (logged === null) return <main className={styles.main}>Carregando…</main>;

  return (
    <main className={styles.main}>
      <h1>Hub do Caio</h1>

      {!logged ? (
        <form onSubmit={onLogin} className={styles.card}>
          <h2>Entrar</h2>
          <input name="email" type="email" placeholder="E-mail" required autoComplete="username" />
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Senha"
            required
            autoComplete="current-password"
          />
          <label className={styles.check}>
            <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
            Mostrar senha
          </label>
          <button disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
          {error && <p className={styles.error}>{error}</p>}
        </form>
      ) : (
        <>
          <form onSubmit={onUpload} className={styles.card}>
            <h2>Enviar planilha mensal</h2>
            <input name="arquivo" type="file" accept=".xlsx" required />
            <button disabled={busy}>{busy ? "Enviando…" : "Enviar"}</button>
            {error && <p className={styles.error}>{error}</p>}
            {result && (
              <>
                <p className={styles.ok}>Planilha importada.</p>
                <pre>{JSON.stringify(result, null, 2)}</pre>
              </>
            )}
          </form>

          {history.length > 0 && (
            <div className={styles.card}>
              <h2>Últimos envios</h2>
              <ul>
                {history.map((h) => (
                  <li key={h.id}>
                    {h.arquivo} — {new Date(h.enviado_em).toLocaleString("pt-BR")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button className={styles.link} onClick={() => signOut({ redirect: false }).then(() => setLogged(false))}>
            Sair
          </button>
        </>
      )}
    </main>
  );
}
