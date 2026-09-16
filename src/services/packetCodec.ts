
import { PacketBreakdown } from '../types';

export const PROTOCOL = {
  PREAMBLE: '1010101010101010',
  START_MARKER: '11111111',
  END_MARKER: '00000000',
  MAX_PAYLOAD_LEN: 8192,
};

export function crc16(data: Uint8Array): number {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) > 0) crc = (crc << 1) ^ 0x1021;
      else crc = crc << 1;
    }
  }
  return crc & 0xFFFF;
}

// --- MILITARY GRADE ECDH CRYPTO ---
export async function generateECDH() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
  const pubRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  return { keyPair, pubRaw: new Uint8Array(pubRaw) };
}

export async function deriveAES(privateKey: CryptoKey, foreignPubRaw: Uint8Array): Promise<CryptoKey> {
  const foreignPub = await crypto.subtle.importKey(
    "raw", foreignPubRaw, { name: "ECDH", namedCurve: "P-256" }, true, []
  );
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: foreignPub },
    privateKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptWithKey(data: Uint8Array, aesKey: CryptoKey): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, data);
  const res = new Uint8Array(12 + enc.byteLength);
  res.set(iv, 0);
  res.set(new Uint8Array(enc), 12);
  return res;
}

export async function decryptWithKey(data: Uint8Array, aesKey: CryptoKey): Promise<Uint8Array> {
  const iv = data.slice(0, 12);
  const enc = data.slice(12);
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, enc);
  return new Uint8Array(dec);
}

// --- UTILS ---
export function bytesToBits(data: Uint8Array): string {
  let bits = '';
  for (let i = 0; i < data.length; i++) bits += data[i].toString(2).padStart(8, '0');
  return bits;
}
export function bitsToBytes(bits: string): Uint8Array {
  const arr = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return arr;
}
export function textToBytes(text: string): Uint8Array { return new TextEncoder().encode(text); }
export function bytesToText(bytes: Uint8Array): string { return new TextDecoder().decode(bytes); }
export function numberTo16Bits(n: number): string { return n.toString(2).padStart(16, '0'); }

// --- TRANSPORT LAYER (Unencrypted, payload must be encrypted BEFORE this) ---
export async function buildPacket(data: Uint8Array, bitDurationMs: number = 40): Promise<PacketBreakdown> {
  const lengthBits = numberTo16Bits(data.length);
  const dataBits = bytesToBits(data);
  const checksum = crc16(data);
  const checksumBits = numberTo16Bits(checksum); 

  const full = PROTOCOL.PREAMBLE + PROTOCOL.START_MARKER + lengthBits + dataBits + checksumBits + PROTOCOL.END_MARKER;
  
  return {
    full, preamble: PROTOCOL.PREAMBLE, startMarker: PROTOCOL.START_MARKER,
    lengthBits, dataBits, checksumBits, endMarker: PROTOCOL.END_MARKER,
    checksum, payloadLength: data.length, totalDurationMs: full.length * bitDurationMs,
    estimatedBps: 1000 / bitDurationMs,
  };
}

export async function buildTransportPacket(
  type: number, targetId: number, senderId: number, msgId: number, chunkIdx: number, totalChunks: number, 
  payloadBytes: Uint8Array, bitDurationMs: number = 40
): Promise<PacketBreakdown> {
  const header = new Uint8Array([type, targetId, senderId, msgId, chunkIdx, totalChunks]);
  const combined = new Uint8Array(header.length + payloadBytes.length);
  combined.set(header, 0);
  combined.set(payloadBytes, header.length);
  return buildPacket(combined, bitDurationMs);
}
