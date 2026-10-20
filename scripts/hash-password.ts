/**
 * Gera o ADMIN_PASSWORD_HASH (bcrypt) do login do Caio.
 * Uso: npm run hash-password   (a senha é digitada sem aparecer na tela)
 */
import bcrypt from "bcryptjs";
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
  const hash = bcrypt.hashSync(password, 12);
  console.log("\nNo .env.local (o `$` precisa de barra):");
  console.log(`ADMIN_PASSWORD_HASH=${hash.replace(/\$/g, "\\$")}`);
  console.log("\nNo painel da Vercel (valor puro, sem barras):");
  console.log(hash);
}

void main();
