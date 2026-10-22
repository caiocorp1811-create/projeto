"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
import styles from "./shell.module.css";

const ITENS = [
  { href: "/", label: "Visão geral" },
  { href: "/clientes", label: "Clientes" },
  { href: "/tarefas", label: "Tarefas" },
  { href: "/importar", label: "Importar" },
] as const;

function indiceAtivo(pathname: string) {
  return ITENS.findIndex((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)));
}

/** Menu principal em pílulas. A pílula escura desliza até o item da página atual. */
export function NavPills() {
  const ativo = indiceAtivo(usePathname());
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const pilula = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const posicionar = () => {
      const el = links.current[ativo];
      const p = pilula.current;
      if (!p) return;
      if (!el) {
        p.style.opacity = "0";
        return;
      }
      p.style.opacity = "1";
      p.style.width = `${el.offsetWidth}px`;
      p.style.transform = `translateX(${el.offsetLeft}px)`;
    };
    posicionar();
    // só liga a transição depois da primeira posição, para a pílula não "voar" ao carregar
    const raf = requestAnimationFrame(() => pilula.current?.setAttribute("data-pronta", ""));
    window.addEventListener("resize", posicionar);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", posicionar);
    };
  }, [ativo]);

  return (
    <nav aria-label="Menu principal" className={styles.nav}>
      <span ref={pilula} className={styles.navPill} aria-hidden="true" />
      {ITENS.map((item, i) => (
        <Link
          key={item.href}
          href={item.href}
          ref={(el) => {
            links.current[i] = el;
          }}
          aria-current={i === ativo ? "page" : undefined}
          className={styles.navLink}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
