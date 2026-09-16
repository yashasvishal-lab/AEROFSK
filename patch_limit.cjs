const fs = require('fs');

// ==========================================
// 1. REWRITE PACKET CODEC FOR ECDH
// ==========================================
const codecCode = `
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
`;
fs.writeFileSync('src/services/packetCodec.ts', codecCode);
console.log("Rebuilt packetCodec.ts with ECDH");

// ==========================================
// 2. REWRITE MODEM CONTEXT TO SUPPORT ECDH STATE MACHINE
// ==========================================
let ctxCode = fs.readFileSync('src/context/ModemContext.tsx', 'utf8');

// Update imports
ctxCode = ctxCode.replace(
  "import { buildPacket, buildTransportPacket, textToBytes, bytesToText } from '../services/packetCodec';",
  "import { buildPacket, buildTransportPacket, textToBytes, bytesToText, generateECDH, deriveAES, encryptWithKey, decryptWithKey } from '../services/packetCodec';"
);

// We need to inject the ECDH state maps inside the provider
// Add refs for keys
const refsInject = `
  const engineRef = useRef<AudioModemEngine | null>(null);
  const abortTxRef = useRef<boolean>(false);
  
  // Cryptographic State
  const ecdhKeysRef = useRef<{ [nodeId: number]: CryptoKey }>({});
  const myEphemeralKeys = useRef<{ [nodeId: number]: CryptoKeyPair }>({});
`;
ctxCode = ctxCode.replace(
  "const engineRef = useRef<AudioModemEngine | null>(null);\n  const abortTxRef = useRef<boolean>(false);",
  refsInject
);

// Re-write onMessageReceived handler for the state machine
const oldMsgHandler = /onMessageReceived: \(msg\) => \{[\s\S]*?\},/g;
const newMsgHandler = `
      onMessageReceived: async (msg) => {
        if (!msg.bytes || msg.bytes.length < 6) return;
        const decrypted = msg.bytes;

        const type = decrypted[0];
        const targetId = decrypted[1];
        const senderId = decrypted[2];
        const msgId = decrypted[3];
        const chunkIdx = decrypted[4];
        const totalChunks = decrypted[5];
        const data = decrypted.slice(6);

        if (type === 2) {
          addLog(\`[ARQ] Received ACK for Msg \${msgId}\`, 'ok');
          window.dispatchEvent(new CustomEvent('modem_ack', { detail: { msgId, chunkIdx } }));
          return;
        }

        if (targetId !== 0 && targetId !== myNodeId) {
          addLog(\`Ignored packet addressed to Node \${targetId}\`, "info");
          return;
        }

        // ACK standard targeted packets
        if (targetId === myNodeId && type !== 2) {
          setTimeout(async () => {
             if (!engineRef.current) return;
             const ackPkt = await buildTransportPacket(2, senderId, myNodeId, msgId, chunkIdx, 1, new Uint8Array(0), config.bitDurationMs);
             await engineRef.current.transmitBitstream(ackPkt.full);
          }, 300);
        }

        // ECDH KEY OFFER (Type 3)
        if (type === 3) {
           addLog(\`[ECDH] Received Key Offer from Node \${senderId}. Generating ephemeral key...\`, "info");
           const { keyPair, pubRaw } = await generateECDH();
           const sharedAes = await deriveAES(keyPair.privateKey, data);
           ecdhKeysRef.current[senderId] = sharedAes;
           addLog(\`[ECDH] Shared AES-256 Secret derived. Replying with Key Accept...\`, "ok");
           
           setTimeout(async () => {
              if (!engineRef.current) return;
              const acceptPkt = await buildTransportPacket(4, senderId, myNodeId, Math.floor(Math.random()*255), 1, 1, pubRaw, config.bitDurationMs);
              await engineRef.current.transmitBitstream(acceptPkt.full);
           }, 800);
           return;
        }

        // ECDH KEY ACCEPT (Type 4)
        if (type === 4) {
           addLog(\`[ECDH] Received Key Accept from Node \${senderId}.\`, "info");
           const myPriv = myEphemeralKeys.current[senderId];
           if (myPriv) {
              const sharedAes = await deriveAES(myPriv.privateKey, data);
              ecdhKeysRef.current[senderId] = sharedAes;
              addLog(\`[ECDH] Handshake Complete. Secure Tunnel Established.\`, "ok");
              window.dispatchEvent(new CustomEvent(\`ecdh_ready_\${senderId}\`));
           }
           return;
        }

        // SECURE PAYLOAD (Type 5)
        if (type === 5) {
           const aesKey = ecdhKeysRef.current[senderId];
           if (!aesKey) {
              addLog(\`[SECURE] Received encrypted data from Node \${senderId} but no keys exist!\`, "error");
              return;
           }
           try {
              const plaintext = await decryptWithKey(data, aesKey);
              setMessages(prev => [{...msg, text: \`[SECURE] \${bytesToText(plaintext)}\`, senderId, targetId}, ...prev]);
              addLog(\`[SECURE] Decrypted AES-256 payload from Node \${senderId}\`, 'ok');
           } catch(e) {
              addLog(\`[SECURE] Failed to decrypt payload from Node \${senderId}\`, 'error');
           }
           return;
        }

        // DEFAULT (Type 1 - Unencrypted/Files)
        if (totalChunks > 1) {
          setFileTransfers(prev => {
             const existing = prev[msgId] || { msgId, filename: 'file.dat', mimeType: 'application/octet-stream', totalChunks, chunks: {}, completed: false, progress: 0 };
             existing.chunks[chunkIdx] = data;
             existing.progress = Object.keys(existing.chunks).length / totalChunks;
             if (existing.progress === 1 && !existing.completed) {
                existing.completed = true;
                let totalLen = 0;
                for(let i=1; i<=totalChunks; i++) totalLen += existing.chunks[i].length;
                const fullArray = new Uint8Array(totalLen);
                let offset = 0;
                for(let i=1; i<=totalChunks; i++) {
                   fullArray.set(existing.chunks[i], offset);
                   offset += existing.chunks[i].length;
                }
                const blob = new Blob([fullArray], { type: 'application/octet-stream' });
                existing.dataUrl = URL.createObjectURL(blob);
                addLog(\`File reception complete (Msg \${msgId})\`, 'ok');
                setMessages(m => [{...msg, text: \`[FILE RECEIVED] \${totalChunks} chunks\`, senderId, targetId, isFile: true, id: existing.dataUrl}, ...m]);
             }
             return {...prev, [msgId]: existing};
          });
        } else {
          setMessages(prev => [{...msg, text: bytesToText(data), senderId, targetId}, ...prev]);
        }
      },
`;

// Use replace on the context code
const extractedMatches = ctxCode.match(/onMessageReceived: \([\s\S]*?^      \},/m);
if (extractedMatches) {
   ctxCode = ctxCode.replace(extractedMatches[0], newMsgHandler.trim());
}

// Add the transmitSecureMessage function
const secureTransmitMethod = `
  const transmitSecureMessage = useCallback(
    async (text: string, targetId: number) => {
      if (!engineRef.current || isTransmitting || targetId === 0) return;
      abortTxRef.current = false;
      setIsTransmitting(true);
      
      try {
        let aesKey = ecdhKeysRef.current[targetId];
        
        if (!aesKey) {
           addLog(\`[ECDH] Initiating Military-Grade Handshake with Node \${targetId}...\`, "info");
           const { keyPair, pubRaw } = await generateECDH();
           myEphemeralKeys.current[targetId] = keyPair;
           
           const offerPkt = await buildTransportPacket(3, targetId, myNodeId, Math.floor(Math.random()*255), 1, 1, pubRaw, config.bitDurationMs);
           
           setTxProgress({ percent: 0, currentBit: offerPkt.full[0], bitIndex: 0, totalBits: offerPkt.full.length });
           await engineRef.current.transmitBitstream(offerPkt.full, (p, b, i) => setTxProgress({ percent: p, currentBit: b, bitIndex: i, totalBits: offerPkt.full.length }));
           
           addLog(\`[ECDH] Key Offer Sent. Waiting for Accept...\`, "warn");
           
           const accepted = await new Promise(resolve => {
              const h = () => resolve(true);
              window.addEventListener(\`ecdh_ready_\${targetId}\`, h);
              setTimeout(() => { window.removeEventListener(\`ecdh_ready_\${targetId}\`, h); resolve(false); }, 15000);
           });
           
           if (!accepted) throw new Error("ECDH Handshake Timeout");
           aesKey = ecdhKeysRef.current[targetId];
        }

        addLog(\`[SECURE] Encrypting payload with AES-256-GCM...\`, "info");
        const ciphertext = await encryptWithKey(textToBytes(text), aesKey);
        const msgId = Math.floor(Math.random() * 255);
        const securePkt = await buildTransportPacket(5, targetId, myNodeId, msgId, 1, 1, ciphertext, config.bitDurationMs);
        
        await engineRef.current.transmitBitstream(securePkt.full, (p, b, i) => setTxProgress({ percent: p, currentBit: b, bitIndex: i, totalBits: securePkt.full.length }));
        addLog(\`[SECURE] Encrypted payload delivered.\`, "ok");
        
      } catch (err: any) {
        addLog(\`Secure transmission failed: \${err.message}\`, 'error');
      } finally {
        setIsTransmitting(false);
        setTxProgress({ percent: 0, currentBit: '', bitIndex: 0, totalBits: 0 });
      }
    },
    [config.bitDurationMs, isTransmitting, addLog, myNodeId]
  );
`;

ctxCode = ctxCode.replace(
  "const transmitMessage = useCallback(",
  secureTransmitMethod + "\n\n  const transmitMessage = useCallback("
);

// Fix buildTransportPacket signature inside transmitMessage and transmitFile
ctxCode = ctxCode.replace(/buildTransportPacket\([\s\S]*?config\.channelKey, config\.bitDurationMs\)/g, function(match) {
   return match.replace("config.channelKey, ", "");
});

// Expose transmitSecureMessage
ctxCode = ctxCode.replace("transmitMessage,", "transmitMessage,\n    transmitSecureMessage,");

// Update interface
ctxCode = ctxCode.replace("transmitMessage: (text: string, targetId: number) => void;", "transmitMessage: (text: string, targetId: number) => void;\n  transmitSecureMessage: (text: string, targetId: number) => void;");

// Update default baud rate to 40ms to make ECDH fast
ctxCode = ctxCode.replace("bitDurationMs: 80,", "bitDurationMs: 40,");


fs.writeFileSync('src/context/ModemContext.tsx', ctxCode);
console.log("Rebuilt ModemContext.tsx");

// ==========================================
// 3. UPDATE TRANSMITTER UI
// ==========================================
let txCode = fs.readFileSync('src/components/TransmitterPanel.tsx', 'utf8');

txCode = txCode.replace(
  "const { transmitMessage, transmitFile, isTransmitting, txProgress, config, myNodeId, stopTransmission } = useModem();",
  "const { transmitMessage, transmitSecureMessage, transmitFile, isTransmitting, txProgress, config, myNodeId, stopTransmission } = useModem();"
);

txCode = txCode.replace(
  "import { Send, Square, TerminalSquare, Layers, Search, FileUp, Network } from 'lucide-react';",
  "import { Send, Square, TerminalSquare, Layers, Search, FileUp, Network, LockKeyhole } from 'lucide-react';"
);

// Add the secure button
const txButtons = `
          {/* Transmission Action Button & Real-Time Progress */}
          <div className="pt-2">
            {!isTransmitting ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => transmitMessage(message.trim(), targetId)}
                  disabled={!message.trim()}
                  className="flex-1 px-6 py-3.5 rounded-xl font-display font-bold text-sm tracking-wider uppercase bg-slate-800 text-slate-100 hover:bg-slate-700 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  <span>Transmit Clear</span>
                </button>
                <button
                  type="button"
                  onClick={() => transmitSecureMessage(message.trim(), targetId)}
                  disabled={!message.trim() || targetId === 0}
                  className="flex-1 px-6 py-3.5 rounded-xl font-display font-bold text-sm tracking-wider uppercase bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 hover:brightness-110 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={targetId === 0 ? "Target an explicit Node ID to use ECDH Security" : "Initiate ECDH Handshake and transmit encrypted"}
                >
                  <LockKeyhole className="w-4 h-4" />
                  <span>Transmit Secure</span>
                </button>
              </div>
            ) : (`;

txCode = txCode.replace(
  /<div className="pt-2">[\s\S]*?{!isTransmitting \? \([\s\S]*?<\/button>\s*\) : \(/m,
  txButtons
);

fs.writeFileSync('src/components/TransmitterPanel.tsx', txCode);
console.log("Rebuilt TransmitterPanel.tsx");


// ==========================================
// 4. CLEANUP PACKET MODAL
// ==========================================
let modalCode = fs.readFileSync('src/components/PacketInspectorModal.tsx', 'utf8');
modalCode = modalCode.replace(
  "import { buildPacket, crc16, textToBytes, bytesToBits } from '../services/packetCodec';",
  "import { crc16, textToBytes, bytesToBits } from '../services/packetCodec';"
);
fs.writeFileSync('src/components/PacketInspectorModal.tsx', modalCode);

