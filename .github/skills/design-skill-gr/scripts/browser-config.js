// Explicit installed browser path; never weaken browser protection.
const fs = require('fs');
function chromePath() {
  const p = process.env.CHROME_PATH;
  if (!p || !require('path').isAbsolute(p) || !fs.statSync(p).isFile())
    throw new Error('Set CHROME_PATH to an installed Chrome executable; no sandbox bypass.');
  return p;
}
module.exports={chromePath};
