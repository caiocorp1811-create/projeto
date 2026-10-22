/**
 * Define a senha do login do Caio: gera o ADMIN_PASSWORD_HASH (bcrypt) e grava no .env.local.
 * Uso: npm run hash-password   (a senha é digitada duas vezes, sem aparecer na tela)
 */
import bcrypt from "bcryptjs";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

function askHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    const out = rl as unknown as { _writeToOutput: (s: string) => void };
    const original = out._writeToOutput.bind(rl);
    out._writeToOutput = (s) => {
      if (!muted) original(s);
    };
    rl.question(prompt, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    muted = true;
  });
}

async function main() {
  const password = await askHidden("Senha: ");
  if (password.length < 12) {
    console.error("Use ao menos 12 caracteres.");
    process.exit(1);
  }
  if ((await askHidden("Repita a senha: ")) !== password) {
    console.error("As senhas são diferentes. Nada foi alterado.");
    process.exit(1);
  }

  const hash = bcrypt.hashSync(password, 12);
  // No .env.local o `$` precisa de barra (senão o Next o trata como variável e corta o hash).
  // split/join evita as regras especiais de `$` do String.replace.
  const line = `ADMIN_PASSWORD_HASH=${hash.split("$").join("\\$")}`;

  const file = ".env.local";
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  const kept = current.split(/\r?\n/).filter((l) => l && !l.startsWith("ADMIN_PASSWORD_HASH="));
  writeFileSync(file, [...kept, line].join("\n") + "\n");

  console.log("\nADMIN_PASSWORD_HASH gravado no .env.local. Reinicie o servidor (npm run dev).");
  console.log("\nNo painel da Vercel (valor puro, sem barras):");
  console.log(hash);
}

void main();
