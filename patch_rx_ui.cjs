const fs = require('fs');
let code = fs.readFileSync('src/components/ReceiverPanel.tsx', 'utf8');

code = code.replace(
  "import { Mic, MicOff, Activity, Copy, Check, Binary, Sparkles, CheckCircle2, XCircle, Trash2, Radio, Network, FileDown, ShieldCheck } from 'lucide-react';",
  "import { Mic, MicOff, Activity, Copy, Check, Binary, Sparkles, CheckCircle2, XCircle, Trash2, Radio, Network, FileDown, ShieldCheck, Lock } from 'lucide-react';"
);

// Replace FEC active stage text
code = code.replace(
  "{ id: 'fec', label: 'FEC/CRYPTO', active: ['READING_CHECKSUM', 'MESSAGE_OK'].includes(rxState), detail: 'Decoding...' },",
  "{ id: 'fec', label: 'AES-GCM/CRC', active: ['READING_CHECKSUM', 'MESSAGE_OK'].includes(rxState), detail: 'Decoding...' },"
);

// Remove FEC fixed badge block
code = code.replace(
  /\{\(msg\.fecCorrections \?\? 0\) > 0 && \([\s\S]*?\{\/\* end fec \*\/\}/g,
  ""
); // I didn't add "end fec" comments, so I will use a precise replace below

fs.writeFileSync('src/components/ReceiverPanel.tsx', code);
