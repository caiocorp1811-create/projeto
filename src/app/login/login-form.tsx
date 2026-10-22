"use client";

import { useActionState, useState } from "react";
import { login } from "@/lib/auth-actions";
import { IconAlert, IconArrowRight, IconEye, IconEyeOff } from "@/components/icons";
import styles from "./login.module.css";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  return (
    // a key muda a cada tentativa errada, o que reinicia a animação de "tremida"
    <form key={state?.tentativa ?? 0} action={action} className={`${styles.card} ${state ? styles.shake : ""}`}>
      <div className={styles.cardHead}>
        <h2>Entrar</h2>
        <p>Use o e-mail e a senha de acesso ao painel.</p>
      </div>

      {state && (
        <div role="alert" className={styles.error}>
          <IconAlert size={18} />
          {state.erro}
        </div>
      )}

      <div className={styles.field}>
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="voce@exemplo.com"
          defaultValue={state?.email}
          required
          autoFocus={!state}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="password">Senha</label>
        <span className={styles.senha}>
          <input
            id="password"
            name="password"
            type={mostrarSenha ? "text" : "password"}
            autoComplete="current-password"
            required
            autoFocus={Boolean(state)}
          />
          <button
            type="button"
            className={styles.olho}
            onClick={() => setMostrarSenha((v) => !v)}
            aria-pressed={mostrarSenha}
            aria-label={mostrarSenha ? "Esconder senha" : "Mostrar senha"}
          >
            {mostrarSenha ? <IconEyeOff size={19} /> : <IconEye size={19} />}
          </button>
        </span>
      </div>

      <button type="submit" className={`${styles.submit} press`} disabled={pending}>
        {pending ? (
          <>
            <span className={styles.spinner} aria-hidden="true" />
            Entrando…
          </>
        ) : (
          <>
            Entrar
            <IconArrowRight size={18} />
          </>
        )}
      </button>
      <p className={styles.note}>A sessão expira depois de 8 horas.</p>
    </form>
  );
}
