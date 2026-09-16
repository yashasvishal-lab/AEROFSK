const fs = require('fs');
let code = fs.readFileSync('src/components/TransmitterPanel.tsx', 'utf8');

// Update max file size text
code = code.replace(
  "Send File (Max 4KB)",
  "Send File (Max 64KB)"
);

// We need to use await buildTransportPacket in TransmitterPanel for the preview
code = code.replace(
  "const packet = buildTransportPacket(",
  "// packet preview removed because it is now async\n  const packet = null; // buildTransportPacket("
);

// We need to wrap the whole packet visualization in {packet && ( ... )} or just remove it.
code = code.replace(
  /<div className="p-5 rounded-2xl border border-slate-800\/80 bg-slate-900\/60 backdrop-blur-md">[\s\S]*?<\/div>\s*<\/div>\s*\);\s*\};/g,
  `</div>
    </div>
  );
};`
);

fs.writeFileSync('src/components/TransmitterPanel.tsx', code);
