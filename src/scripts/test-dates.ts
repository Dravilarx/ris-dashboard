import { prisma } from "../lib/prisma";
async function main() {
  const result = await prisma.$queryRaw`SELECT MAX(fechaexamen) as maxDate FROM View_Busqueda_Examen`;
  console.log(result);
}
main().catch(console.error).finally(() => prisma.$disconnect());
