// Non-mutating page preparation; no consent or overlay actions.
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function open(page, url) {
  try { await page.goto(url, {waitUntil:'networkidle2', timeout:45000}); return true; }
  catch (e) { console.error(`Page unavailable: ${e.message}`); return false; }
}
async function dismiss(page) { return {changed:false, reason:'Consent and overlays preserved'}; }
async function scrollThrough(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = await page.evaluate(() => innerHeight);
  for (let y=0; y<Math.min(h,40000); y+=Math.max(1,Math.round(vh*0.7))) {
    await page.evaluate(yy => window.scrollTo(0,yy),y); await sleep(180);
  }
  await page.evaluate(() => window.scrollTo(0,0)); await sleep(400);
}
async function prepare(page,url,initialPath) {
  if (!await open(page,url)) return false;
  await sleep(2500);
  if (initialPath) await page.screenshot({path:initialPath});
  await scrollThrough(page);
  return true;
}
module.exports={prepare,open,dismiss,scrollThrough,sleep};
