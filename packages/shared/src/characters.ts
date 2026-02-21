export interface CharacterBase {
  name: string;
  hp: number;
  attack: number;
  defense: number;
}

export const CHARACTERS: CharacterBase[] = [
  { name: "ドラゴン", hp: 105, attack: 30, defense: 15 },
  { name: "ナイト", hp: 100, attack: 25, defense: 30 },
  { name: "ウィザード", hp: 80, attack: 45, defense: 10 },
  { name: "ゴーレム", hp: 150, attack: 20, defense: 35 },
  { name: "アサシン", hp: 80, attack: 50, defense: 5 },
  { name: "プリースト", hp: 90, attack: 25, defense: 25 },
];
