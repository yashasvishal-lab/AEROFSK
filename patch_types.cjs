const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

code = code.replace(
  "fecCorrections?: number;",
  "bytes?: Uint8Array;"
);

fs.writeFileSync('src/types.ts', code);
