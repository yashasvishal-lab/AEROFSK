const fs = require('fs');

// --- 1. PATCH PACKET CODEC ---
let codecCode = fs.readFileSync('src/services/packetCodec.ts', 'utf8');
codecCode = codecCode.replace(
  "targetId: number, senderId: number, msgId: number, chunkIdx: number, totalChunks: number",
  "type: number, targetId: number, senderId: number, msgId: number, chunkIdx: number, totalChunks: number"
);
codecCode = codecCode.replace(
  "const header = new Uint8Array([targetId, senderId, msgId, chunkIdx, totalChunks]);",
  "const header = new Uint8Array([type, targetId, senderId, msgId, chunkIdx, totalChunks]);"
);
fs.writeFileSync('src/services/packetCodec.ts', codecCode);
console.log("Patched packetCodec");

// --- 2. PATCH MODEM CONTEXT ---
let ctxCode = fs.readFileSync('src/context/ModemContext.tsx', 'utf8');

// Header destructuring
ctxCode = ctxCode.replace(
  "const targetId = decrypted[0];",
  "const type = decrypted[0];\n        const targetId = decrypted[1];"
);
ctxCode = ctxCode.replace("const senderId = decrypted[1];", "const senderId = decrypted[2];");
ctxCode = ctxCode.replace("const msgId = decrypted[2];", "const msgId = decrypted[3];");
ctxCode = ctxCode.replace("const chunkIdx = decrypted[3];", "const chunkIdx = decrypted[4];");
ctxCode = ctxCode.replace("const totalChunks = decrypted[4];", "const totalChunks = decrypted[5];");
ctxCode = ctxCode.replace("const data = decrypted.slice(5);", "const data = decrypted.slice(6);");

// ACK handling
ctxCode = ctxCode.replace(
  "if (targetId !== 0 && targetId !== myNodeId) {",
  `if (type === 2) {
          addLog(\`[ARQ] Received ACK for Msg \${msgId} Chunk \${chunkIdx}\`, 'ok');
          window.dispatchEvent(new CustomEvent('modem_ack', { detail: { msgId, chunkIdx } }));
          return;
        }
        
        if (targetId !== 0 && targetId !== myNodeId) {`
);

// Transmitting ACK on File Chunks
ctxCode = ctxCode.replace(
  "if (totalChunks > 1) {",
  `if (type === 1 && targetId === myNodeId) {
          // Send ACK back for reliable file transfer
          setTimeout(async () => {
             if (!engineRef.current) return;
             const ackPkt = await buildTransportPacket(2, senderId, myNodeId, msgId, chunkIdx, 1, new Uint8Array(0), config.channelKey, config.bitDurationMs);
             await engineRef.current.transmitBitstream(ackPkt.full);
          }, 400); // Give channel time to clear
        }
        
        if (totalChunks > 1) {`
);

// Update transmitMessage
ctxCode = ctxCode.replace(
  "await buildTransportPacket(targetId",
  "await buildTransportPacket(0, targetId"
);

// Update transmitFile payload loop
const oldFileCall = "await buildTransportPacket(targetId";
ctxCode = ctxCode.replace(oldFileCall, "await buildTransportPacket(1, targetId");

// Replace transmitFile internal loop with ARQ logic
const oldLoop = `const pkt = await buildTransportPacket(1, targetId, myNodeId, msgId, chunkIdx, totalChunks, data, config.channelKey, config.bitDurationMs);
         
         setTxProgress({ percent: 0, currentBit: pkt.full[0], bitIndex: 0, totalBits: pkt.full.length });
         await engineRef.current.transmitBitstream(pkt.full, (percent, currentBit, bitIndex) => {
           setTxProgress({ percent, currentBit, bitIndex, totalBits: pkt.full.length });
         });
         await new Promise(r => setTimeout(r, 200));
         if (abortTxRef.current) throw new Error('Aborted');`;

const newLoop = `const pkt = await buildTransportPacket(1, targetId, myNodeId, msgId, chunkIdx, totalChunks, data, config.channelKey, config.bitDurationMs);
         
         let success = false;
         for (let attempt = 1; attempt <= 3; attempt++) {
            if (abortTxRef.current) throw new Error('Aborted');
            setTxProgress({ percent: 0, currentBit: pkt.full[0], bitIndex: 0, totalBits: pkt.full.length });
            await engineRef.current.transmitBitstream(pkt.full, (percent, currentBit, bitIndex) => {
              setTxProgress({ percent, currentBit, bitIndex, totalBits: pkt.full.length });
            });
            
            if (targetId === 0) {
               // Broadcasts do not request ACKs to avoid ACK storms
               await new Promise(r => setTimeout(r, 400));
               success = true;
               break;
            }

            addLog(\`[ARQ] Waiting for ACK on chunk \${chunkIdx} (Attempt \${attempt}/3)...\`, 'info');
            const acked = await new Promise(resolve => {
               const handler = (e) => {
                  if (e.detail.msgId === msgId && e.detail.chunkIdx === chunkIdx) {
                     window.removeEventListener('modem_ack', handler);
                     resolve(true);
                  }
               };
               window.addEventListener('modem_ack', handler);
               setTimeout(() => {
                  window.removeEventListener('modem_ack', handler);
                  resolve(false);
               }, 4000); // 4s timeout for ACK
            });

            if (acked) {
               success = true;
               break;
            } else {
               addLog(\`[ARQ] Timeout on chunk \${chunkIdx}. Retrying...\`, 'warn');
            }
         }
         
         if (!success) {
            throw new Error(\`Failed to deliver chunk \${chunkIdx} after 3 attempts.\`);
         }
         if (abortTxRef.current) throw new Error('Aborted');`;

ctxCode = ctxCode.replace(oldLoop, newLoop);
fs.writeFileSync('src/context/ModemContext.tsx', ctxCode);
console.log("Patched ModemContext");

