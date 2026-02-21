import { PrismaClient } from "@prisma/client";
import { CHARACTERS } from "@nfc-card-battle/shared";

const prisma = new PrismaClient();

async function main() {
  console.log("シードデータを投入中...");

  for (const character of CHARACTERS) {
    await prisma.character.upsert({
      where: { name: character.name },
      update: character,
      create: character,
    });
  }

  console.log(`${CHARACTERS.length}件のキャラクターを作成しました`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
