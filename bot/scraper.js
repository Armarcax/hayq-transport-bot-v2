// bot/scraper.js
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

// Արտահանելու վերջնական ուղին՝ backend\data\routes.json
const outputPath = path.join(__dirname, '..', 'backend', 'data', 'routes.json');

// Բոլոր էջերի հղումներ
const urls = [
  'http://marshrut.info/',
  'http://marshrut.info/?paged=2',
  'http://marshrut.info/?paged=3',
  'http://marshrut.info/?paged=4',
  'http://marshrut.info/?paged=5',
  'http://marshrut.info/?paged=6',
  'http://marshrut.info/?paged=7',
  'http://marshrut.info/?paged=8',
  'http://marshrut.info/?paged=9',
];

async function scrapeRoutes() {
  try {
    const routes = [];

    for (const url of urls) {
      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);

      $('table tbody tr').each((i, el) => {
        let number = $(el).find('td').eq(0).text().trim();
        let routeText = $(el).find('td').eq(1).text().trim();

        if (!number || !routeText) return;

        // Բաժանում տեքստը մեծ տառերով սկիզբ/վերջ և մանր տառերով մանրամասն երթուղի
        const lines = routeText.split('\n').map(l => l.trim()).filter(l => l);
        const startEnd = lines[0]; // Ընդհանուր գծագրի վերնագիրը
        const stopsDetail = lines.slice(1).join(' → '); // մնացած մանրամասնությունը

        // Ստեղծում է մեկ ամբողջական stops զանգված, որպես մեկ տարր
        const stops = [stopsDetail];

        // Ստուգում՝ չկրկնվի արդեն
        if (!routes.some(r => r.number === number && r.start === startEnd && r.end === startEnd)) {
          routes.push({
            number: number,
            start: startEnd,
            end: startEnd,
            stops
          });
        }
      });
    }

    fs.writeFileSync(outputPath, JSON.stringify(routes, null, 2), 'utf8');
    console.log(`✅ Exported ${routes.length} routes to ${outputPath}`);
  } catch (err) {
    console.error('❌ Error scraping routes:', err);
  }
}

// Շահագործում
scrapeRoutes();
