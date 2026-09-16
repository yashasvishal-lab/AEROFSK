const fs = require('fs');
let code = fs.readFileSync('src/services/audioEngine.ts', 'utf8');

code = code.replace(
  "import { PROTOCOL, bitsToText, xorChecksum, cipher } from './packetCodec';",
  "import { PROTOCOL, bytesToText, bitsToBytes, crc16, decryptAES } from './packetCodec';"
);
code = code.replace(
  "import { PROTOCOL, bitsToText, xorChecksum } from './packetCodec';",
  "import { PROTOCOL, bytesToText, bitsToBytes, crc16, decryptAES } from './packetCodec';"
);

code = code.replace(
  "if (this.rxByteBuffer.length === 8) {\n        this.rxExpectedLen = parseInt(this.rxByteBuffer, 2);",
  "if (this.rxByteBuffer.length === 16) {\n        this.rxExpectedLen = parseInt(this.rxByteBuffer, 2);"
);

code = code.replace(
  /if \(this\.rxState === 'READING_CHECKSUM'\) \{[\s\S]*?return;\n    \}/,
  `if (this.rxState === 'READING_CHECKSUM') {
      if (this.rxByteBuffer.length === 16) {
        const receivedChecksum = parseInt(this.rxByteBuffer, 2);
        const processedBytes = bitsToBytes(this.rxDataBits);
        const expectedChecksum = crc16(processedBytes);
        const isValid = receivedChecksum === expectedChecksum;
        const avgSnrDb =
          this.currentSnrSamples > 0 ? Math.round(this.currentSnrSum / this.currentSnrSamples) : 0;

        (async () => {
          try {
            const plaintextBytes = isValid ? await decryptAES(processedBytes, this.config.channelKey) : processedBytes;
            
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
            };

            if (isValid) {
              this.setRxState('MESSAGE_OK');
              this.onLog?.(
                \`Packet CRC-16 matched. Forwarding to transport layer... [SNR: \${avgSnrDb}dB]\`,
                'ok'
              );
            } else {
              this.setRxState('CHECKSUM_ERROR');
              this.onLog?.(
                \`CRC-16 mismatch! R: 0x\${receivedChecksum.toString(16)} E: 0x\${expectedChecksum.toString(16)}\`,
                'error'
              );
            }

            this.onMessageReceived?.(messageRecord);
          } catch(e) {
             this.onLog?.("Decryption failed (AES-GCM). Wrong PIN?", "error");
          }
        })();
        
        this.rxByteBuffer = '';
        setTimeout(() => this.reHunt(), 500);
      }
      return;
    }`
);

code = code.replace(
  "public async transmitBitstream(",
  `public async checkChannelClear(): Promise<boolean> {
    if (!this.analyser) return true;
    const data = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatFrequencyData(data);
    const binHz = this.ctx.sampleRate / this.analyser.fftSize;
    const getEnergy = (freq) => data[Math.round(freq / binHz)];
    return getEnergy(this.config.freq0) < -55 && getEnergy(this.config.freq1) < -55;
  }

  public async transmitBitstream(`
);

code = code.replace(
  "const bitDurSec = this.config.bitDurationMs / 1000;",
  `let isClear = false;
    let attempts = 0;
    while (!isClear && attempts < 8) {
      isClear = await this.checkChannelClear();
      if (!isClear) {
         this.onLog?.('CSMA/CA: Channel busy (Carrier detected). Backing off...', 'warn');
         await new Promise(r => setTimeout(r, 400 + Math.random() * 400));
         attempts++;
      }
    }
    const bitDurSec = this.config.bitDurationMs / 1000;`
);

fs.writeFileSync('src/services/audioEngine.ts', code);
