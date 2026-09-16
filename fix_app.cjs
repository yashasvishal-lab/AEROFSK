const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// The settings panel still asks for a PIN which we just deleted, let's update it to just show status.
code = code.replace(
  /<div className="space-y-1.5">[\s\S]*?<label className="text-xs font-medium text-slate-300">[\s\S]*?Channel Security PIN[\s\S]*?<\/div>\s*<\/div>/g,
  `<div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Channel Security Protocol
                    </label>
                    <div className="flex items-center space-x-2 px-3 py-2 bg-slate-900 border border-emerald-500/40 rounded-xl">
                       <Lock className="w-4 h-4 text-emerald-400" />
                       <span className="text-xs font-mono-code text-emerald-400">Military-Grade ECDH (P-256) Active</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Keys are negotiated autonomously over-the-air using Elliptic-Curve Diffie-Hellman.</p>
                  </div>
                </div>`
);

fs.writeFileSync('src/App.tsx', code);
