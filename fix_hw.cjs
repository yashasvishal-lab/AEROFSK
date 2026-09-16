const fs = require('fs');
let code = fs.readFileSync('src/components/HowItWorksPanel.tsx', 'utf8');

const securityInfo = `
        {/* Security Info */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center space-x-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h4 className="font-display font-semibold text-sm text-slate-200">Military-Grade ECDH Cryptography</h4>
          </div>
          <p className="text-xs text-slate-400 mb-2">
            The platform now features an autonomous <strong>Elliptic-Curve Diffie-Hellman (P-256)</strong> handshake. Instead of typing a shared PIN, clicking "Transmit Secure" forces the two nodes to physically negotiate a secret over the airwaves.
          </p>
          <ul className="text-xs font-mono-code text-slate-500 space-y-1 mt-2 list-disc pl-4">
            <li><strong className="text-emerald-300">Phase 1:</strong> Node A generates a P-256 Keypair and transmits its Public Key over audio.</li>
            <li><strong className="text-emerald-300">Phase 2:</strong> Node B receives it, generates its own Keypair, derives the shared AES secret, and broadcasts its Public Key back.</li>
            <li><strong className="text-emerald-300">Phase 3:</strong> Node A receives B's Public Key, derives the exact same AES secret, and encrypts the actual payload using AES-256-GCM.</li>
          </ul>
        </div>
`;

code = code.replace(
  /<div className="p-4 rounded-xl bg-slate-950 border border-slate-800">\s*<div className="flex items-center space-x-2 mb-3">\s*<ShieldCheck className="w-5 h-5 text-emerald-400" \/>[\s\S]*?<\/div>\s*<\/div>/,
  securityInfo
);

fs.writeFileSync('src/components/HowItWorksPanel.tsx', code);
