import { CLASSES } from "@/lib/classes";
import { brlCompacto, pct } from "@/lib/format";
import type { Distribution } from "@/lib/metrics";
import styles from "./distribution.module.css";

/** Blocos proporcionais por classe + lista com valor e percentual. */
export function DistributionBlocks({
  dist,
  valores,
  delay = 600,
}: {
  dist: Distribution;
  valores: Record<keyof Distribution, number> | null;
  delay?: number;
}) {
  const visiveis = CLASSES.filter((c) => dist[c.key] > 0);
  const rotulo = CLASSES.map((c) => `${c.nome} ${pct(dist[c.key])}`).join(", ");

  return (
    <>
      <div role="img" aria-label={rotulo} className={styles.blocos}>
        {visiveis.map((c, i) => (
          <span
            key={c.key}
            className={`${styles.bloco} grow`}
            style={{ flexGrow: dist[c.key], background: c.cor, animationDelay: `${delay + i * 80}ms` }}
          />
        ))}
      </div>
      <div className={styles.lista}>
        {CLASSES.map((c) => (
          <div key={c.key} className={styles.linha}>
            <span className={styles.ponto} style={{ background: c.cor }} />
            <span>{c.nome}</span>
            <span className={styles.valor}>{valores ? brlCompacto(valores[c.key]) : ""}</span>
            <span className={styles.pct}>{pct(dist[c.key])}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/** Barrinha fina de distribuição (para listas e cartões de cliente). */
export function DistributionBar({ dist }: { dist: Distribution }) {
  const rotulo = CLASSES.map((c) => `${c.nome} ${pct(dist[c.key])}`).join(", ");
  return (
    <span role="img" aria-label={rotulo} className={styles.barra}>
      {CLASSES.filter((c) => dist[c.key] > 0).map((c) => (
        <span key={c.key} className="grow" style={{ flexGrow: dist[c.key], background: c.cor }} />
      ))}
    </span>
  );
}

/** Legenda das quatro classes. */
export function ClassLegend() {
  return (
    <span className={styles.legenda}>
      {CLASSES.map((c) => (
        <span key={c.key}>
          <span className={styles.ponto} style={{ background: c.cor }} />
          {c.nome}
        </span>
      ))}
    </span>
  );
}
