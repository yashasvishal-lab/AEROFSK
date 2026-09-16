const fs = require('fs');
let code = fs.readFileSync('src/components/HowItWorksPanel.tsx', 'utf8');

const arqSection = `        {/* Future Tech & ARQ */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center space-x-2 mb-3">
            <Radio className="w-5 h-5 text-indigo-400" />
            <h4 className="font-display font-semibold text-sm text-slate-200">ARQ & Future Architectures</h4>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            The transport layer now features <strong>Automatic Repeat reQuest (ARQ)</strong>. File transfers require the receiver to transmit an Acoustic ACK tone. If an ACK is missed due to room noise, the transmitter auto-retries.
          </p>
          <div className="space-y-2 mt-4 border-t border-slate-800/80 pt-4">
            <span className="text-[10px] font-mono-code text-indigo-400 block mb-1">PROPOSED FUTURE UPGRADES</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-xs font-semibold text-slate-300 block mb-1">OFDM Modulation</span>
                <span className="text-[10px] text-slate-500">Transmitting on 64 overlapping frequencies simultaneously (like Wi-Fi) to achieve hundreds of bytes per second.</span>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-xs font-semibold text-slate-300 block mb-1">Chirp Spread Spectrum (CSS)</span>
                <span className="text-[10px] text-slate-500">Sweeping frequency tones (like LoRa or sonar) to cut through extreme echoes and extend range massively.</span>
              </div>
            </div>
          </div>
        </div>`;

code = code.replace(
  "        {/* Security Info */}",
  arqSection + "\n\n        {/* Security Info */}"
);

fs.writeFileSync('src/components/HowItWorksPanel.tsx', code);
