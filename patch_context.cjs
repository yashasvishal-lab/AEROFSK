const fs = require('fs');
let code = fs.readFileSync('src/context/ModemContext.tsx', 'utf8');

code = code.replace(
  "import { buildPacket, buildTransportPacket, decodeFEC, cipher } from '../services/packetCodec';",
  "import { buildPacket, buildTransportPacket, textToBytes, bytesToText } from '../services/packetCodec';"
);

code = code.replace(
  /onMessageReceived: \(msg\) => \{[\s\S]*?fecRes\.errors\}\, \.\.\.prev\]\);[\s\S]*?\}\,/,
  `onMessageReceived: (msg) => {
        if (!msg.bytes || msg.bytes.length < 5) return;
        const decrypted = msg.bytes;

        const targetId = decrypted[0];
        const senderId = decrypted[1];
        const msgId = decrypted[2];
        const chunkIdx = decrypted[3];
        const totalChunks = decrypted[4];
        const data = decrypted.slice(5);

        if (targetId !== 0 && targetId !== myNodeId) {
          addLog(\`Ignored packet addressed to Node \${targetId} (I am \${myNodeId})\`, "info");
          return;
        }

        if (totalChunks > 1) {
          setFileTransfers(prev => {
             const existing = prev[msgId] || { msgId, filename: 'file.dat', mimeType: 'application/octet-stream', totalChunks, chunks: {}, completed: false, progress: 0 };
             // Use base64 encoding just for the chunks dictionary storage to avoid complexity, or just store arrays
             // Let's store Uint8Arrays and assemble them
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
             } else {
                addLog(\`Received chunk \${chunkIdx}/\${totalChunks}\`, 'info');
             }
             return {...prev, [msgId]: existing};
          });
        } else {
          setMessages(prev => [{...msg, text: bytesToText(data), senderId, targetId}, ...prev]);
          addLog(\`Packet from Node \${senderId} received via AES-GCM\`, 'ok');
        }
      },`
);

code = code.replace(
  /const transmitMessage = useCallback\([\s\S]*?addLog, myNodeId\]\n  \);/,
  `const transmitMessage = useCallback(
    async (text: string, targetId: number = 0) => {
      if (!engineRef.current || isTransmitting) return;
      const msgId = Math.floor(Math.random() * 255);
      abortTxRef.current = false;
      const pkt = await buildTransportPacket(targetId, myNodeId, msgId, 1, 1, textToBytes(text), config.channelKey, config.bitDurationMs);

      setIsTransmitting(true);
      setTxProgress({ percent: 0, currentBit: pkt.full[0], bitIndex: 0, totalBits: pkt.full.length });
      addLog(
        \`Transmitting "\${text}" to Node \${targetId} (\${pkt.payloadLength} B, \${pkt.full.length} bits)...\`,
        'info'
      );

      try {
        await engineRef.current.transmitBitstream(pkt.full, (percent, currentBit, bitIndex) => {
          setTxProgress({ percent, currentBit, bitIndex, totalBits: pkt.full.length });
        });
        addLog(\`Burst completed for "\${text}".\`, 'ok');
      } catch (err) {
        addLog(\`Transmission error\`, 'error');
      } finally {
        setIsTransmitting(false);
        setTxProgress({ percent: 0, currentBit: '', bitIndex: 0, totalBits: 0 });
      }
    },
    [config.bitDurationMs, config.channelKey, isTransmitting, addLog, myNodeId]
  );`
);

code = code.replace(
  /const transmitFile = useCallback\([\s\S]*?addLog, myNodeId\]\);/,
  `const transmitFile = useCallback(async (file: File, targetId: number) => {
     if (!engineRef.current || isTransmitting) return;
     const msgId = Math.floor(Math.random() * 255);
     const buffer = await file.arrayBuffer();
     const uint8 = new Uint8Array(buffer);
     
     const chunkSize = 256; 
     const totalChunks = Math.ceil(uint8.length / chunkSize);
     
     if (totalChunks > 255) {
       addLog("File too large. Max 64KB allowed.", "error");
       return;
     }

     abortTxRef.current = false;
     setIsTransmitting(true);
     addLog(\`Starting file transfer: \${file.name} (\${totalChunks} chunks)\`, "info");
     
     try {
       for(let chunkIdx=1; chunkIdx<=totalChunks; chunkIdx++) {
         if (abortTxRef.current) throw new Error('Aborted');
         const data = uint8.slice((chunkIdx-1)*chunkSize, chunkIdx*chunkSize);
         const pkt = await buildTransportPacket(targetId, myNodeId, msgId, chunkIdx, totalChunks, data, config.channelKey, config.bitDurationMs);
         
         setTxProgress({ percent: 0, currentBit: pkt.full[0], bitIndex: 0, totalBits: pkt.full.length });
         await engineRef.current.transmitBitstream(pkt.full, (percent, currentBit, bitIndex) => {
           setTxProgress({ percent, currentBit, bitIndex, totalBits: pkt.full.length });
         });
         await new Promise(r => setTimeout(r, 200));
         if (abortTxRef.current) throw new Error('Aborted');
       }
       addLog(\`File \${file.name} sent successfully.\`, 'ok');
     } catch(e) {
        addLog("File transfer aborted.", "error");
     } finally {
        setIsTransmitting(false);
        setTxProgress({ percent: 0, currentBit: '', bitIndex: 0, totalBits: 0 });
     }
  }, [config.bitDurationMs, config.channelKey, isTransmitting, addLog, myNodeId]);`
);


fs.writeFileSync('src/context/ModemContext.tsx', code);
