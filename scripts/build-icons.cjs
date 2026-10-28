// Rebuild extension PNGs and the resource-free header mark from one vector master.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
  const master=fs.readFileSync(path.join(root,'icons/logo-mark.svg'),'utf8');
  const inline=master.replace(/<title>[\s\S]*?<\/title>/g,'').replace(/>\s+</g,'><').trim()
    .replace('<svg ','<svg data-ytc-entry-icon="" aria-hidden="true" focusable="false" style="width:28px;height:28px;display:block;pointer-events:none" ');
  const entryPath=path.join(root,'content/in-page-settings.js'),entry=fs.readFileSync(entryPath,'utf8');
  const generated=/  \/\/ BEGIN GENERATED ENTRY ICON[\s\S]*?  \/\/ END GENERATED ENTRY ICON/;
  if(!generated.test(entry))throw Error('Inline entry icon markers not found');
  const updated=entry.replace(generated,()=>`  // BEGIN GENERATED ENTRY ICON\n  const ENTRY_ICON = ${JSON.stringify(inline)};\n  // END GENERATED ENTRY ICON`);
  if(updated!==entry)fs.writeFileSync(entryPath,updated);
  if(process.argv.includes('--entry-only')){console.log('Updated inline header icon from icons/logo-mark.svg.');return;}
  const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({deviceScaleFactor:1});
    const source='data:image/svg+xml;base64,'+Buffer.from(master).toString('base64');
    for(const size of [16,32,48,128,512]){
      await page.setViewportSize({width:size,height:size});
      await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:transparent}img{display:block;width:100%;height:100%}</style><img src="${source}">`);
      await page.locator('img').evaluate(img=>img.decode());
      const png=await page.screenshot({omitBackground:true});
      fs.writeFileSync(path.join(root,'icons',size===512?'logo-mark.png':`icon-${size}.png`),png);
      if(size===512)fs.writeFileSync(path.join(root,'assets/logo.png'),png);
    }
    console.log('Built 16/32/48/128 px extension icons, 512 px logo and inline header mark from icons/logo-mark.svg.');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
