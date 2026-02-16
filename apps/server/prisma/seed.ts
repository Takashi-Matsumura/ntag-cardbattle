import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const characters = [
  { name: "ドラゴン", hp: 120, attack: 35, defense: 15 },
  { name: "ナイト", hp: 100, attack: 25, defense: 30 },
  { name: "ウィザード", hp: 80, attack: 45, defense: 10 },
  { name: "ゴーレム", hp: 150, attack: 20, defense: 35 },
  { name: "アサシン", hp: 70, attack: 50, defense: 5 },
  { name: "プリースト", hp: 90, attack: 15, defense: 25 },
];

async function main() {
  console.log("シードデータを投入中...");

  for (const character of characters) {
    await prisma.character.upsert({
      where: { name: character.name },
      update: character,
      create: character,
    });
  }

  console.log(`${characters.length}件のキャラクターを作成しました`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
