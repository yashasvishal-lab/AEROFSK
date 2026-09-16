const fs = require('fs');
let code = fs.readFileSync('src/services/audioEngine.ts', 'utf8');

code = code.replace(
  "import { PROTOCOL, bytesToText, bitsToBytes, crc16, decryptAES } from './packetCodec';",
  "import { PROTOCOL, bitsToBytes, crc16 } from './packetCodec';"
);

// Decryption is now handled in ModemContext, so we just pass raw bytes up!
const oldBlock = /const plaintextBytes = isValid \? await decryptAES\(processedBytes, this\.config\.channelKey\) : processedBytes;[\s\S]*?rawBits: this.rxDataBits,\n              snrSnapshotDb: avgSnrDb,\n            };/m;

const newBlock = `const plaintextBytes = processedBytes;
            
            const messageRecord = {
              id: Math.random().toString(36).substring(2, 9),
              timestamp: Date.now(),
              text: "BINARY_PAYLOAD", 
              bytes: plaintextBytes,
              length: plaintextBytes.length,
              receivedChecksum,
              expectedChecksum,
              isValid,
              rawBits: this.rxDataBits,
              snrSnapshotDb: avgSnrDb,
            };`;

code = code.replace(oldBlock, newBlock);

fs.writeFileSync('src/services/audioEngine.ts', code);
