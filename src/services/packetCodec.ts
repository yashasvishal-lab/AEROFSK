import { PacketBreakdown } from '../types';

export const PROTOCOL = {
  PREAMBLE: '1010101010101010', // 16 bits
  START_MARKER: '11111111',       // 8 bits
  END_MARKER: '00000000',         // 8 bits
  MAX_PAYLOAD_LEN: 64,            // Maximum 64 chars per acoustic burst
};

/**
 * Converts standard string to 8-bit binary string
 */
export function textToBits(text: string): string {
  let bits = '';
  for (let i = 0; i < text.length; i++) {
    bits += text.charCodeAt(i).toString(2).padStart(8, '0');
  }
  return bits;
}

/**
 * Converts 8-bit binary string back into characters
 */
export function bitsToText(bits: string): string {
  let text = '';
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    const byte = bits.slice(i, i + 8);
    const code = parseInt(byte, 2);
    text += String.fromCharCode(code);
  }
  return text;
}

/**
 * Converts a number to 8-bit string
 */
export function byteToBits(n: number): string {
  return (n & 0xff).toString(2).padStart(8, '0');
}

/**
 * Computes single-byte XOR checksum over text payload
 */
export function xorChecksum(text: string): number {
  let c = 0;
  for (let i = 0; i < text.length; i++) {
    c ^= text.charCodeAt(i);
  }
  return c & 0xff;
}

/**
 * Formulates a complete acoustic protocol packet with telemetry metrics
 */
export function buildPacket(text: string, bitDurationMs: number = 80): PacketBreakdown {
  const truncatedText = text.slice(0, PROTOCOL.MAX_PAYLOAD_LEN);
  const lengthBits = byteToBits(truncatedText.length);
  const dataBits = textToBits(truncatedText);
  const checksum = xorChecksum(truncatedText);
  const checksumBits = byteToBits(checksum);

  const full =
    PROTOCOL.PREAMBLE +
    PROTOCOL.START_MARKER +
    lengthBits +
    dataBits +
    checksumBits +
    PROTOCOL.END_MARKER;

  const totalBits = full.length;
  const totalDurationMs = totalBits * bitDurationMs;
  const estimatedBps = 1000 / bitDurationMs;

  return {
    full,
    preamble: PROTOCOL.PREAMBLE,
    startMarker: PROTOCOL.START_MARKER,
    lengthBits,
    dataBits,
    checksumBits,
    endMarker: PROTOCOL.END_MARKER,
    checksum,
    payloadLength: truncatedText.length,
    totalDurationMs,
    estimatedBps,
  };
}
