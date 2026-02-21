import { EventEmitter, NativeModule, requireNativeModule } from "expo-modules-core";
import type { MultipeerConnectivityEvents } from "./MultipeerConnectivity.types";

export type { PeerEvent, DataEvent, MultipeerConnectivityEvents } from "./MultipeerConnectivity.types";

// ネイティブモジュールがまだコンパイルされていない場合に備え、遅延ロードする
// Expo Routerがすべてのルートを起動時にバンドルするため、
// トップレベルでrequireNativeModuleすると未ビルド時にクラッシュする
let _module: NativeModule | null = null;
let _emitter: EventEmitter | null = null;

function getModule(): NativeModule {
  if (!_module) {
    _module = requireNativeModule<NativeModule>("MultipeerConnectivity");
  }
  return _module;
}

function getEmitter(): EventEmitter {
  if (!_emitter) {
    _emitter = new EventEmitter(getModule());
  }
  return _emitter;
}

// ネイティブモジュールが利用可能か確認
export function isAvailable(): boolean {
  try {
    getModule();
    return true;
  } catch {
    return false;
  }
}

// ホストとして開始（advertise + browse）
export function startHost(displayName: string): void {
  getModule().startHost(displayName);
}

// ゲストとして開始（browse + 自動接続）
export function startGuest(displayName: string): void {
  getModule().startGuest(displayName);
}

// データ送信（JSON文字列）
export function sendData(json: string): void {
  getModule().sendData(json);
}

// 切断
export function disconnect(): void {
  getModule().disconnect();
}

// イベントリスナー
export function addPeerConnectedListener(
  listener: (event: MultipeerConnectivityEvents["onPeerConnected"]) => void
) {
  return getEmitter().addListener("onPeerConnected", listener);
}

export function addPeerDisconnectedListener(
  listener: (event: MultipeerConnectivityEvents["onPeerDisconnected"]) => void
) {
  return getEmitter().addListener("onPeerDisconnected", listener);
}

export function addDataReceivedListener(
  listener: (event: MultipeerConnectivityEvents["onDataReceived"]) => void
) {
  return getEmitter().addListener("onDataReceived", listener);
}
