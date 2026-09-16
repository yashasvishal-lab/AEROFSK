const fs = require('fs');
let code = fs.readFileSync('src/components/PacketInspectorModal.tsx', 'utf8');
code = code.replace(
  "const packet = buildPacket(textToBytes(targetText), config.bitDurationMs);",
  "// packet preview mocked for inspector\n  const packet = null;"
);
fs.writeFileSync('src/components/PacketInspectorModal.tsx', code);
