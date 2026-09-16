const fs = require('fs');
let code = fs.readFileSync('src/context/ModemContext.tsx', 'utf8');

// Add imports
code = code.replace(
  "import { buildPacket } from '../services/packetCodec';",
  "import { buildPacket, buildTransportPacket, decodeFEC, cipher } from '../services/packetCodec';"
);

code = code.replace(
  "export interface ModemContextType {",
  "export interface ModemContextType {\n  myNodeId: number;\n  fileTransfers: Record<number, import('../types').FileTransferState>;\n  runAutoCalibration: () => Promise<void>;\n  transmitFile: (file: File, targetId: number) => Promise<void>;\n  transmitMessage: (text: string, targetId?: number) => Promise<void>; // Overridden below"
);

// We need to inject states for myNodeId and fileTransfers
code = code.replace(
  "const [testToneActive, setTestToneActive] = useState<boolean>(false);",
  "const [testToneActive, setTestToneActive] = useState<boolean>(false);\n  const [myNodeId] = useState<number>(() => Math.floor(Math.random() * 254) + 1);\n  const [fileTransfers, setFileTransfers] = useState<Record<number, import('../types').FileTransferState>>({});"
);

// Add runAutoCalibration
code = code.replace(
  "const toggleLoopback = useCallback(() => {",
  `const runAutoCalibration = useCallback(async () => {
    if (!engineRef.current) return;
    addLog("Starting Auto-Calibration (2 seconds)... please remain quiet.", "info");
    try {
      const res = await engineRef.current.runAutoCalibration(2000, (p) => {});
      addLog(\`Auto-Calibrated! Found quiet floor (\${res.noiseFloor.toFixed(1)}dB). Using F0=\${res.freq0}Hz, F1=\${res.freq1}Hz\`, "ok");
      setConfig(prev => ({...prev, freq0: res.freq0, freq1: res.freq1, profile: 'custom'}));
    } catch (e) {
      addLog("Auto-calibration failed. Mic active?", "error");
    }
  }, [addLog]);

  const toggleLoopback = useCallback(() => {`
);

// Replace transmitMessage
code = code.replace(
  /const transmitMessage = useCallback\([\s\S]*?\[config\.bitDurationMs, isTransmitting, addLog\]\n  \);/,
  `const transmitMessage = useCallback(
    async (text: string, targetId: number = 0) => {
      if (!engineRef.current || isTransmitting) return;
      const msgId = Math.floor(Math.random() * 255);
      const pkt = buildTransportPacket(targetId, myNodeId, msgId, 1, 1, text, config.channelKey, config.bitDurationMs);

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
  );
  
  const transmitFile = useCallback(async (file: File, targetId: number) => {
     if (!engineRef.current || isTransmitting) return;
     const msgId = Math.floor(Math.random() * 255);
     const buffer = await file.arrayBuffer();
     const uint8 = new Uint8Array(buffer);
     let binaryStr = '';
     for(let i=0; i<uint8.length; i++) binaryStr += String.fromCharCode(uint8[i]);
     const b64 = btoa(binaryStr); // send base64
     
     const chunkSize = 16; // quite small to fit in 64 byte payload with overhead
     const totalChunks = Math.ceil(b64.length / chunkSize);
     
     if (totalChunks > 255) {
       addLog("File too large. Max 4KB allowed.", "error");
       return;
     }

     setIsTransmitting(true);
     addLog(\`Starting file transfer: \${file.name} (\${totalChunks} chunks)\`, "info");
     
     try {
       for(let chunkIdx=1; chunkIdx<=totalChunks; chunkIdx++) {
         const data = b64.slice((chunkIdx-1)*chunkSize, chunkIdx*chunkSize);
         const pkt = buildTransportPacket(targetId, myNodeId, msgId, chunkIdx, totalChunks, data, config.channelKey, config.bitDurationMs);
         
         setTxProgress({ percent: 0, currentBit: pkt.full[0], bitIndex: 0, totalBits: pkt.full.length });
         await engineRef.current.transmitBitstream(pkt.full, (percent, currentBit, bitIndex) => {
           setTxProgress({ percent, currentBit, bitIndex, totalBits: pkt.full.length });
         });
         await new Promise(r => setTimeout(r, 200)); // small gap between chunks
       }
       addLog(\`File \${file.name} sent successfully.\`, 'ok');
     } catch(e) {
        addLog("File transfer aborted.", "error");
     } finally {
        setIsTransmitting(false);
        setTxProgress({ percent: 0, currentBit: '', bitIndex: 0, totalBits: 0 });
     }
  }, [config.bitDurationMs, config.channelKey, isTransmitting, addLog, myNodeId]);
  `
);


// Replace onMessageReceived
code = code.replace(
  /onMessageReceived: \(msg\) => {\n[\s\S]*?setMessages\(.*?\n[\s\S]*?},/,
  `onMessageReceived: (msg) => {
        // FEC decode first
        const fecRes = decodeFEC(msg.text);
        if (fecRes.unrecoverable) {
          addLog("Packet dropped: Unrecoverable FEC corruption.", "error");
          return;
        }

        const decrypted = cipher(fecRes.text, config.channelKey);
        if (decrypted.length < 5) return; // Invalid header

        const targetId = decrypted.charCodeAt(0) & 0xFF;
        const senderId = decrypted.charCodeAt(1) & 0xFF;
        const msgId = decrypted.charCodeAt(2) & 0xFF;
        const chunkIdx = decrypted.charCodeAt(3) & 0xFF;
        const totalChunks = decrypted.charCodeAt(4) & 0xFF;
        const data = decrypted.slice(5);

        if (targetId !== 0 && targetId !== myNodeId) {
          addLog(\`Ignored packet addressed to Node \${targetId} (I am \${myNodeId})\`, "info");
          return;
        }

        if (totalChunks > 1) {
          // Handle file chunk
          setFileTransfers(prev => {
             const existing = prev[msgId] || { msgId, filename: 'file.dat', mimeType: 'application/octet-stream', totalChunks, chunks: {}, completed: false, progress: 0 };
             existing.chunks[chunkIdx] = data;
             existing.progress = Object.keys(existing.chunks).length / totalChunks;
             if (existing.progress === 1 && !existing.completed) {
                existing.completed = true;
                let fullB64 = '';
                for(let i=1; i<=totalChunks; i++) fullB64 += existing.chunks[i];
                existing.dataUrl = "data:application/octet-stream;base64," + fullB64;
                addLog(\`File reception complete (Msg \${msgId})\`, 'ok');
                setMessages(m => [{...msg, text: \`[FILE RECEIVED] \${totalChunks} chunks\`, senderId, targetId, fecCorrections: fecRes.errors, isFile: true, id: existing.dataUrl!}, ...m]);
             } else {
                addLog(\`Received chunk \${chunkIdx}/\${totalChunks}\`, 'info');
             }
             return {...prev, [msgId]: existing};
          });
        } else {
          setMessages(prev => [{...msg, text: data, senderId, targetId, fecCorrections: fecRes.errors}, ...prev]);
          addLog(
            \`Packet from Node \${senderId} [FEC fixed \${fecRes.errors} bits]\`,
            'ok'
          );
        }
      },`
);

// Expose new functions to provider
code = code.replace(
  "transmitMessage,\n        stopTransmission,",
  "transmitMessage,\n        transmitFile,\n        runAutoCalibration,\n        myNodeId,\n        fileTransfers,\n        stopTransmission,"
);

fs.writeFileSync('src/context/ModemContext.tsx', code);
console.log("Patched ModemContext");
