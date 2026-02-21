export type PeerEvent = {
  peerId: string;
  displayName: string;
};

export type DataEvent = {
  peerId: string;
  data: string;
};

export type MultipeerConnectivityEvents = {
  onPeerConnected: PeerEvent;
  onPeerDisconnected: PeerEvent;
  onDataReceived: DataEvent;
};
