import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";
import styles from "./login.module.css";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage() {
  if ((await auth())?.user) redirect("/");

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={`${styles.brand} rv`}>
          <span className={styles.logo}>H</span>
          hub do caio
        </div>
        <h1 className={styles.title}>
          <span className="ln">
            <span style={{ animationDelay: "80ms" }}>A carteira</span>
          </span>
          <span className="ln">
            <span style={{ animationDelay: "180ms" }}>dos seus clientes,</span>
          </span>
          <span className="ln">
            <span style={{ animationDelay: "280ms" }} className={styles.accent}>
              num só lugar.
            </span>
          </span>
        </h1>
        <p className={`${styles.lead} rv`} style={{ animationDelay: "420ms" }}>
          Patrimônio, evolução e distribuição de cada cliente, atualizados a cada fechamento da
          planilha.
        </p>
        <div className={`${styles.tags} rv`} style={{ animationDelay: "520ms" }}>
          <span className={styles.tag}>
            <span className={styles.dot} style={{ background: "var(--pine)" }} />
            Patrimônio
          </span>
          <span className={styles.tag}>
            <span className={styles.dot} style={{ background: "var(--tomato)" }} />
            Distribuição
          </span>
          <span className={styles.tag}>
            <span className={styles.dot} style={{ background: "var(--butter)" }} />
            Tarefas
          </span>
        </div>
      </section>

      <main className={`${styles.cardWrap} rv`} style={{ animationDelay: "250ms" }}>
        <LoginForm />
      </main>
    </div>
  );
}
