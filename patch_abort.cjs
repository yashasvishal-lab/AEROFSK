const fs = require('fs');
let code = fs.readFileSync('src/context/ModemContext.tsx', 'utf8');

// Add abortTxRef
code = code.replace(
  "const engineRef = useRef<AudioModemEngine | null>(null);",
  "const engineRef = useRef<AudioModemEngine | null>(null);\n  const abortTxRef = useRef<boolean>(false);"
);

// Reset abortTxRef in transmitMessage
code = code.replace(
  "setIsTransmitting(true);\n      setTxProgress({ percent: 0, currentBit: pkt.full[0], bitIndex: 0, totalBits: pkt.full.length });",
  "abortTxRef.current = false;\n      setIsTransmitting(true);\n      setTxProgress({ percent: 0, currentBit: pkt.full[0], bitIndex: 0, totalBits: pkt.full.length });"
);

// Stop if aborted in transmitMessage (though transmitBitstream is one chunk, so we just handle errors generally)
// But for transmitFile, it's crucial:
code = code.replace(
  "setIsTransmitting(true);\n     addLog(`Starting file transfer: ${file.name} (${totalChunks} chunks)`, \"info\");",
  "abortTxRef.current = false;\n     setIsTransmitting(true);\n     addLog(`Starting file transfer: ${file.name} (${totalChunks} chunks)`, \"info\");"
);

code = code.replace(
  "for(let chunkIdx=1; chunkIdx<=totalChunks; chunkIdx++) {",
  "for(let chunkIdx=1; chunkIdx<=totalChunks; chunkIdx++) {\n         if (abortTxRef.current) throw new Error('Aborted');"
);

code = code.replace(
  "await new Promise(r => setTimeout(r, 200)); // small gap between chunks\n       }",
  "await new Promise(r => setTimeout(r, 200)); // small gap between chunks\n         if (abortTxRef.current) throw new Error('Aborted');\n       }"
);

code = code.replace(
  "const stopTransmission = useCallback(() => {\n    if (engineRef.current) {\n      engineRef.current.stopTransmission();\n      setIsTransmitting(false);\n      setTxProgress({ percent: 0, currentBit: '', bitIndex: 0, totalBits: 0 });\n      addLog('Transmission aborted by operator.', 'warn');\n    }\n  }, [addLog]);",
  "const stopTransmission = useCallback(() => {\n    abortTxRef.current = true;\n    if (engineRef.current) {\n      engineRef.current.stopTransmission();\n      setIsTransmitting(false);\n      setTxProgress({ percent: 0, currentBit: '', bitIndex: 0, totalBits: 0 });\n      addLog('Transmission aborted by operator.', 'warn');\n    }\n  }, [addLog]);"
);

fs.writeFileSync('src/context/ModemContext.tsx', code);
console.log("Patched ModemContext abort");
