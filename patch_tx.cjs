const fs = require('fs');
let code = fs.readFileSync('src/components/TransmitterPanel.tsx', 'utf8');

code = code.replace(
  "const { transmitMessage, transmitFile, isTransmitting, txProgress, config, myNodeId } = useModem();",
  "const { transmitMessage, transmitFile, isTransmitting, txProgress, config, myNodeId, stopTransmission } = useModem();"
);

code = code.replace(
  "onClick={() => {/* no-op for now to avoid breaking */}}",
  "onClick={stopTransmission}"
);

fs.writeFileSync('src/components/TransmitterPanel.tsx', code);
console.log("Patched TransmitterPanel halt");
