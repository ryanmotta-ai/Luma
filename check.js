const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  await page.goto('file:///c:/Users/tropa/OneDrive/Documentos/Luma/index.html', {waitUntil: 'networkidle0'});
  
  // Click Designer tab
  await page.evaluate(() => {
    setMode('designer');
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  const visibility = await page.evaluate(() => {
    const d = document.getElementById('view-designer');
    const tb = document.getElementById('d-topbar');
    return {
      designerVisible: d ? window.getComputedStyle(d).display : null,
      topbarVisible: tb ? window.getComputedStyle(tb).display : null,
      topbarHeight: tb ? tb.offsetHeight : null
    };
  });
  console.log('Visibility:', visibility);
  await browser.close();
})();
