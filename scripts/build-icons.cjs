// Rebuild crisp extension PNGs from the editable vector master.
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({deviceScaleFactor:1});
    const source='data:image/svg+xml;base64,'+fs.readFileSync(path.join(root,'icons/logo-mark.svg')).toString('base64');
    for(const size of [16,32,48,128,512]){
      await page.setViewportSize({width:size,height:size});
      await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:transparent}img{display:block;width:100%;height:100%}</style><img src="${source}">`);
      await page.locator('img').evaluate(img=>img.decode());
      const png=await page.screenshot({omitBackground:true});
      fs.writeFileSync(path.join(root,'icons',size===512?'logo-mark.png':`icon-${size}.png`),png);
      if(size===512)fs.writeFileSync(path.join(root,'assets/logo.png'),png);
    }
    console.log('Built 16/32/48/128 px extension icons and 512 px logo from icons/logo-mark.svg.');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
