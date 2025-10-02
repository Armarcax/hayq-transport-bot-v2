require('dotenv').config();
const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const chalk = require('chalk');
const express = require('express');

const botConfig = require('./config/botConfig');
const mainMenu = require('./handlers/mainMenu');
const routeMenu = require('./handlers/routeMenu');
const helpHandler = require('./handlers/helpHandler');

const app = express();

// --- Bot Initialization (SAFE MODE) ---
const bot = new TelegramBot(botConfig.token, { polling: false });

// --- Webhook Setup ---
const url = process.env.RENDER_EXTERNAL_URL || `https://hayqwaybot.onrender.com`;
bot.setWebHook(`${url}/bot${botConfig.token}`);

app.use(express.json());
app.post(`/bot${botConfig.token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// --- Assets ---
const logoLarge = path.join(__dirname, 'images', 'hayq-logo-small.png');
const logoMini = path.join(__dirname, 'images', 'hayq-logo-mini.png');

// --- User state ---
const userLocations = {};
const LOG_LEVELS = { INFO: 'info', WARN: 'warn', ERROR: 'error' };
let currentLogLevel = LOG_LEVELS.INFO;

function log(message, level = LOG_LEVELS.INFO) {
  const prefix = `[${new Date().toISOString()}]`;
  switch (level) {
    case LOG_LEVELS.INFO:
      if (currentLogLevel === LOG_LEVELS.INFO) console.log(chalk.blue(`${prefix} INFO: ${message}`));
      break;
    case LOG_LEVELS.WARN:
      if (currentLogLevel === LOG_LEVELS.INFO || currentLogLevel === LOG_LEVELS.WARN)
        console.log(chalk.yellow(`${prefix} WARN: ${message}`));
      break;
    case LOG_LEVELS.ERROR:
      console.log(chalk.red(`${prefix} ERROR: ${message}`));
      break;
  }
}

// --- Տվյալների լոդինգ ---
const stopsPath = path.join(__dirname, '..', 'backend', 'data', 'routes_small_full_with_eta_updated.json');
let routes = [];
let stops = [];

try {
  routes = JSON.parse(fs.readFileSync(stopsPath, 'utf8'));
  stops = routes.flatMap(route => {
    if (!Array.isArray(route.stops)) return [];
    const routeNumber = route.number ?? route.id ?? 'N/A';
    const routeStart = route.start?.hy ?? 'Start';
    const routeEnd = route.end?.hy ?? 'End';
    return route.stops.map(stop => ({
      ...stop,
      routeId: routeNumber,
      routeName: `${routeStart} → ${routeEnd}`,
      coords: stop.coords ?? { lat: null, lng: null },
      eta_min: stop.eta_min ?? null,
      time: stop.time ?? null,
      name: stop.name ?? { hy: 'Անհայտ', en: 'Unknown', ru: 'Неизвестно' }
    }));
  });
  log(`Loaded ${stops.length} stops from ${routes.length} routes`, LOG_LEVELS.INFO);
} catch (err) {
  log(`Error parsing routes file: ${err.message}`, LOG_LEVELS.ERROR);
}

// --- Հեռավորության հաշվարկ ---
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// --- Մոտակա կանգառի որոնում ---
function findNearestStop(userLat, userLon) {
  let minDistance = Infinity;
  let nearestStop = null;
  for (const stop of stops) {
    if (!stop.coords || stop.coords.lat == null || stop.coords.lng == null) continue;
    const d = haversineMeters(userLat, userLon, stop.coords.lat, stop.coords.lng);
    if (d < minDistance) {
      minDistance = d;
      nearestStop = stop;
    }
  }
  return { stop: nearestStop, distance: minDistance };
}

// --- Երթուղիներ մոտակայքից ---
function findRoutesNear(userLat, userLon, radius = 1000) {
  return routes.filter(route =>
    route.stops?.some(s => s.coords?.lat != null && s.coords?.lng != null &&
      haversineMeters(userLat, userLon, s.coords.lat, s.coords.lng) <= radius
    )
  );
}

// --- Կանգառներ անվան հիման վրա ---
function searchStopsByName(query) {
  const q = query.trim().toLowerCase();
  return stops.filter(s => s.name?.hy?.toLowerCase().includes(q));
}

// --- Ֆայլ ուղարկել ---
function sendFile(chatId, filePath, caption = '', type = 'document') {
  const finalPath = fs.existsSync(filePath) ? filePath : logoMini;
  if (!fs.existsSync(finalPath)) return;
  const options = { caption };
  return type === 'photo'
    ? bot.sendPhoto(chatId, fs.createReadStream(finalPath), options)
    : bot.sendDocument(chatId, fs.createReadStream(finalPath), options);
}

function sendLogo(chatId, type = 'mini', caption = '') {
  return sendFile(chatId, type === 'large' ? logoLarge : logoMini, caption, 'photo');
}

// --- /start ---
bot.onText(/\/start/, msg => {
  const chatId = msg.chat.id;
  sendLogo(chatId, 'large', 'Բարև ձեզ, սա HAYQ Way–ն է!').then(() => mainMenu.showMainMenu(bot, chatId));
});

// --- /near <lat> <lon> ---
bot.onText(/\/near (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const args = match[1].split(' ');
  if (args.length < 2) return bot.sendMessage(chatId, 'Խնդրում եմ ուղարկեք latitude և longitude: /near <lat> <lon>');
  const userLat = parseFloat(args[0]);
  const userLon = parseFloat(args[1]);
  if (isNaN(userLat) || isNaN(userLon)) return bot.sendMessage(chatId, 'Խնդրում ենք ճիշտ թվային կոորդինատներ։');

  const { stop, distance } = findNearestStop(userLat, userLon);
  if (!stop) return bot.sendMessage(chatId, 'Ներեցեք, կանգառներ չեն գտնվել։');

  const eta = stop.eta_min != null && stop.eta_min > 0 ? Math.round(stop.eta_min) : routeMenu.estimateETA(userLat, userLon, stop);
  const response = `🚌 Մոտակա կանգառը:\n<b>${stop.name.hy}</b>\nԵրթուղի: ${stop.routeName}\n📍 Հեռավորություն ≈ ${Math.round(distance)} մ\n⏱ մոտավորապես 🔴 <b>${eta} րոպե</b>\n🕒 Ժամանակ: ${stop.time ?? 'Անհայտ'}`;
  bot.sendMessage(chatId, response, { parse_mode: 'HTML' });
});

// --- Լոկացիա ստացում ---
bot.on('location', msg => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userLat = msg.location.latitude;
  const userLon = msg.location.longitude;

  userLocations[userId] = { lat: userLat, lon: userLon };

  const nearbyRoutes = findRoutesNear(userLat, userLon, 1000);
  if (!nearbyRoutes.length) return bot.sendMessage(chatId, 'Ներեցեք, այս շրջանի համար ավտոբուսներ չեն գտնվել։');

  const keyboard = nearbyRoutes.map(r => ([{ text: `🚍 ${r.number}: ${r.start?.hy ?? ''} → ${r.end?.hy ?? ''}`, callback_data: `show_route_${r.number}` }]));
  bot.sendMessage(chatId, `📍 Ձեր մոտակայքում գտնված ավտոբուսների երթուղիներ (մոտավորապես 1կմ շառավղով):`, { reply_markup: { inline_keyboard: keyboard } });
});

// --- Տեքստային որոնում ---
bot.on('message', msg => {
  const { chat, text, from } = msg;
  if (!text) return;
  const userId = from.id;

  if (text === '📍 Ուղարկել լոկացիա') {
    bot.sendMessage(chat.id, 'Խնդրում եմ սեղմեք կոճակը և ընտրեք "Share Location" կամ օգտագործեք /near <lat> <lon>։', {
      reply_markup: { keyboard: [[{ text: 'Send My Location', request_location: true }]], one_time_keyboard: true, resize_keyboard: true }
    });
    return;
  }

  if (!text.startsWith('/')) {
    routeMenu.handleRouteSelection(bot, { message: msg, data: 'route_search' }, userLocations[userId]?.lat, userLocations[userId]?.lon);
  }
});

log('✅ HAYQ Way Bot is running...', LOG_LEVELS.INFO);

// --- Express server ---
const PORT = process.env.PORT || 5000;
app.get('/', (req, res) => {
  res.send('✅ HAYQ Way Bot is running with Webhook!');
});
app.listen(PORT, () => {
  log(`Web server running on port ${PORT}`, LOG_LEVELS.INFO);
});
