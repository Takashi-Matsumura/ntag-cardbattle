import Link from "next/link";

export default function Home() {
  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">NFC Card Battle 管理画面</h1>
      <nav className="space-y-4">
        <Link
          href="/admin/cards"
          className="block p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-semibold">カード管理</h2>
          <p className="text-gray-600">
            登録済みカードの一覧・キャラクター割当
          </p>
        </Link>
        <Link
          href="/admin/simulator"
          className="block p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-semibold">バトルシミュレーター</h2>
          <p className="text-gray-600">
            全マッチアップの勝率・膠着率を分析・パラメータ調整
          </p>
        </Link>
      </nav>
    </main>
  );
}
