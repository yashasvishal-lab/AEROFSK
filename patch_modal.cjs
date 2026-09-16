const fs = require('fs');
let code = fs.readFileSync('src/components/PacketInspectorModal.tsx', 'utf8');

code = code.replace(
  "import { buildPacket, xorChecksum, textToBits } from '../services/packetCodec';",
  "import { buildPacket, crc16, textToBytes, bytesToBits } from '../services/packetCodec';"
);

code = code.replace(
  "const baseChecksum = xorChecksum(targetText);",
  "const baseChecksum = crc16(textToBytes(targetText));"
);

code = code.replace(
  "const targetBits = textToBits(targetText);",
  "const targetBits = bytesToBits(textToBytes(targetText));"
);

fs.writeFileSync('src/components/PacketInspectorModal.tsx', code);
