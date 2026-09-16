const fs = require('fs');
let code = fs.readFileSync('src/components/ReceiverPanel.tsx', 'utf8');

// The FEC block looks like:
// {(msg.fecCorrections ?? 0) > 0 && (
//   <span className="inline-flex items-center space-x-1 text-[10px] font-mono-code px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
//     <ShieldCheck className="w-3 h-3 text-amber-400" />
//     <span>FEC FIXED {msg.fecCorrections} BITS</span>
//   </span>
// )}
code = code.replace(
  /\{\(msg\.fecCorrections \?\? 0\) > 0 && \([\s\S]*?\)\}/g,
  ""
);

code = code.replace(
  "FEC will be handled automatically.",
  "AES-GCM encryption will be handled automatically."
);

fs.writeFileSync('src/components/ReceiverPanel.tsx', code);
