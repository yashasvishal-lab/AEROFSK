const fs = require('fs');
let code = fs.readFileSync('src/components/HowItWorksPanel.tsx', 'utf8');

code = code.replace(
  "We integrated a standard Hamming(7,4) Code",
  "We integrated a 16-bit Cyclic Redundancy Check (CRC-16)"
);
code = code.replace(
  "For every 4 bits of raw data, 3 extra parity bits",
  "A 16-bit mathematical checksum is appended to every packet"
);
code = code.replace(
  "If acoustic interference flips a single bit in transit, the receiver performs syndrome decoding to locate and correct the error on the fly.",
  "If acoustic interference flips any bits in transit, the CRC validation will fail and reject the packet, preventing corrupt data."
);
code = code.replace(
  "XOR Stream Cipher",
  "AES-GCM (Web Crypto API)"
);
code = code.replace(
  "Pseudo-random keystream generated using a Linear Congruential Generator",
  "Military-grade symmetric encryption authenticated with Galois/Counter Mode"
);

fs.writeFileSync('src/components/HowItWorksPanel.tsx', code);
