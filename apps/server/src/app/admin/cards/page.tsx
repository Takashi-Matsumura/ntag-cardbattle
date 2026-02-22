"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Character {
  id: number;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  imageUrl: string | null;
}

export default function CardsPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  // --- キャラクター作成フォーム ---
  const [newChar, setNewChar] = useState({
    name: "",
    hp: 100,
    attack: 25,
    defense: 15,
  });
  const [editingChar, setEditingChar] = useState<Character | null>(null);

  const fetchData = async () => {
    const charsRes = await fetch("/api/characters");
    setCharacters(await charsRes.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // キャラクター作成
  const createCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newChar),
    });
    setNewChar({ name: "", hp: 100, attack: 25, defense: 15 });
    fetchData();
  };

  // キャラクター更新
  const updateCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChar) return;
    await fetch(`/api/characters/${editingChar.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingChar),
    });
    setEditingChar(null);
    fetchData();
  };

  // キャラクター削除
  const deleteCharacter = async (id: number) => {
    if (!confirm("このキャラクターを削除しますか？")) return;
    await fetch(`/api/characters/${id}`, { method: "DELETE" });
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-8">
      <Link href="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
        ← ホームに戻る
      </Link>
      <h1 className="text-3xl font-bold mb-8">キャラクター管理</h1>

      {/* --- キャラクター一覧 --- */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">キャラクター</h2>

        {/* 作成フォーム */}
        <form
          onSubmit={createCharacter}
          className="bg-white p-4 rounded-lg shadow mb-4 flex flex-wrap gap-3 items-end"
        >
          <div>
            <label className="block text-sm text-gray-600">名前</label>
            <input
              type="text"
              value={newChar.name}
              onChange={(e) => setNewChar({ ...newChar, name: e.target.value })}
              className="border rounded px-2 py-1 w-32"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">HP</label>
            <input
              type="number"
              value={newChar.hp}
              onChange={(e) =>
                setNewChar({ ...newChar, hp: parseInt(e.target.value) || 0 })
              }
              className="border rounded px-2 py-1 w-20"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">攻撃</label>
            <input
              type="number"
              value={newChar.attack}
              onChange={(e) =>
                setNewChar({
                  ...newChar,
                  attack: parseInt(e.target.value) || 0,
                })
              }
              className="border rounded px-2 py-1 w-20"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">防御</label>
            <input
              type="number"
              value={newChar.defense}
              onChange={(e) =>
                setNewChar({
                  ...newChar,
                  defense: parseInt(e.target.value) || 0,
                })
              }
              className="border rounded px-2 py-1 w-20"
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700"
          >
            追加
          </button>
        </form>

        {/* 編集モーダル */}
        {editingChar && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <form
              onSubmit={updateCharacter}
              className="bg-white p-6 rounded-lg shadow-lg w-80 space-y-3"
            >
              <h3 className="text-lg font-semibold">キャラクター編集</h3>
              <div>
                <label className="block text-sm text-gray-600">名前</label>
                <input
                  type="text"
                  value={editingChar.name}
                  onChange={(e) =>
                    setEditingChar({ ...editingChar, name: e.target.value })
                  }
                  className="border rounded px-2 py-1 w-full"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm text-gray-600">HP</label>
                  <input
                    type="number"
                    value={editingChar.hp}
                    onChange={(e) =>
                      setEditingChar({
                        ...editingChar,
                        hp: parseInt(e.target.value) || 0,
                      })
                    }
                    className="border rounded px-2 py-1 w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600">攻撃</label>
                  <input
                    type="number"
                    value={editingChar.attack}
                    onChange={(e) =>
                      setEditingChar({
                        ...editingChar,
                        attack: parseInt(e.target.value) || 0,
                      })
                    }
                    className="border rounded px-2 py-1 w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600">防御</label>
                  <input
                    type="number"
                    value={editingChar.defense}
                    onChange={(e) =>
                      setEditingChar({
                        ...editingChar,
                        defense: parseInt(e.target.value) || 0,
                      })
                    }
                    className="border rounded px-2 py-1 w-full"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingChar(null)}
                  className="px-3 py-1 border rounded"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        )}

        {/* キャラクター一覧テーブル */}
        <table className="w-full bg-white rounded-lg shadow">
          <thead>
            <tr className="border-b text-left text-sm text-gray-600">
              <th className="p-3">名前</th>
              <th className="p-3">HP</th>
              <th className="p-3">攻撃</th>
              <th className="p-3">防御</th>
              <th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {characters.map((char) => (
              <tr key={char.id} className="border-b last:border-0">
                <td className="p-3 font-medium">{char.name}</td>
                <td className="p-3">{char.hp}</td>
                <td className="p-3">{char.attack}</td>
                <td className="p-3">{char.defense}</td>
                <td className="p-3 space-x-2">
                  <button
                    onClick={() => setEditingChar(char)}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => deleteCharacter(char.id)}
                    className="text-red-600 hover:underline text-sm"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
