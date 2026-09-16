const fs = require('fs');
let code = fs.readFileSync('src/components/ReceiverPanel.tsx', 'utf8');

code = code.replace(
  "{msg.senderId !== undefined && (",
  "{msg.text.includes('[FILE RECEIVED]') ? <span className=\"inline-flex items-center space-x-1 text-[10px] font-mono-code px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30\"><Network className=\"w-3 h-3\" /><span>ARQ ACK SENT</span></span> : null}\n                    {msg.senderId !== undefined && ("
);

fs.writeFileSync('src/components/ReceiverPanel.tsx', code);
