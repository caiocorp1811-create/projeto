import Link from "next/link";
import type { ReactNode } from "react";
import { IconBell, IconLogout, IconPlus, IconSearch, IconUpload } from "@/components/icons";
import { logout } from "@/lib/auth-actions";
import { ASSESSOR } from "@/lib/config";
import { NavPills } from "./nav-pills";
import styles from "./shell.module.css";

/** Moldura das telas internas: topo (logo, menu, avisos, avatar), barra de atalhos e conteúdo. */
export function AppShell({ children, atrasadas }: { children: ReactNode; atrasadas: number }) {
  return (
    <div className={styles.shell}>
      <header className={`${styles.topbar} rv`}>
        <Link href="/" className={styles.brand}>
          <span className={styles.logo}>H</span>
          hub do caio
        </Link>
        <NavPills />
        <div className={styles.actions}>
          <Link
            href="/tarefas"
            aria-label={atrasadas > 0 ? `Tarefas: ${atrasadas} atrasadas` : "Tarefas"}
            className={`${styles.roundBtn} press`}
          >
            <IconBell size={19} />
            {atrasadas > 0 && <span className={styles.badge}>{atrasadas}</span>}
          </Link>
          <span className={styles.avatar} title={`${ASSESSOR.nome}, ${ASSESSOR.cargo.toLowerCase()}`}>
            {ASSESSOR.iniciais}
          </span>
        </div>
      </header>

      <div className={styles.body}>
        <nav aria-label="Atalhos" className={`${styles.dock} rv`} style={{ animationDelay: "120ms" }}>
          <Link href="/clientes" aria-label="Buscar cliente" data-label="Buscar cliente" className={styles.dockItem}>
            <IconSearch size={19} />
          </Link>
          <Link href="/tarefas" aria-label="Nova tarefa" data-label="Nova tarefa" className={styles.dockItem}>
            <IconPlus size={19} />
          </Link>
          <Link href="/importar" aria-label="Importar planilha" data-label="Importar planilha" className={styles.dockItem}>
            <IconUpload size={19} />
          </Link>
          <hr className={styles.dockSep} />
          <form action={logout}>
            <button type="submit" aria-label="Sair" data-label="Sair" className={styles.dockItem}>
              <IconLogout size={19} />
            </button>
          </form>
        </nav>

        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
