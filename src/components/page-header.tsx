import type { ReactNode } from "react";
import styles from "./page-header.module.css";

/**
 * Título grande da página, revelado linha a linha, com espaço ao lado
 * para os indicadores (children).
 */
export function PageHeader({ linhas, children }: { linhas: string[]; children?: ReactNode }) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>
        {linhas.map((linha, i) => (
          <span key={linha} className="ln">
            <span style={{ animationDelay: `${i * 90}ms` }}>{linha}</span>
          </span>
        ))}
      </h1>
      {children}
    </div>
  );
}

/** Indicador do cabeçalho: ícone redondo, valor, selo opcional e legenda. */
export function HeaderStat({
  icon,
  valor,
  selo,
  legenda,
  delay = 200,
}: {
  icon: ReactNode;
  valor: ReactNode;
  selo?: ReactNode;
  legenda: string;
  delay?: number;
}) {
  return (
    <div className={`${styles.stat} rv`} style={{ animationDelay: `${delay}ms` }}>
      <span className={styles.statIcon}>{icon}</span>
      <span className={styles.statText}>
        <span className={styles.statValue}>
          {valor}
          {selo}
        </span>
        <span className={styles.statLabel}>{legenda}</span>
      </span>
    </div>
  );
}
