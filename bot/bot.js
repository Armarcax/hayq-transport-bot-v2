require('dotenv').config();
const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const chalk = require('chalk');

const botConfig = require('./config/botConfig');
const mainMenu = require('./handlers/mainMenu');
const routeMenu = require('./handlers/routeMenu');
const helpHandler = require('./handlers/helpHandler');

const bot = new TelegramBot(botConfig.token, { polling: true });

const logoLarge = path.join(__dirname, 'images', 'hayq-logo-small.png');
const logoMini = path.join(__dirname, 'images', 'hayq-logo-mini.png');

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
      if (currentLogLevel === LOG_LEVELS.INFO || currentLogLevel === LOG_LEVELS.WARN) console.log(chalk.yellow(`${prefix} WARN: ${message}`));
      break;
    case LOG_LEVELS.ERROR:
      console.log(chalk.red(`${prefix} ERROR: ${message}`));
      break;
  }
}

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

function estimateETA(userLat, userLon, stop) {
  if (!userLat || !userLon || !stop?.coords?.lat || !stop?.coords?.lng) return 1;
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(stop.coords.lat - userLat);
  const dLon = toRad(stop.coords.lng - userLon);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(userLat)) * Math.cos(toRad(stop.coords.lat)) * Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  const speed = 50;
  return Math.max(1, Math.round(distance / speed));
}

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

function findRoutesNear(userLat, userLon, radius = 1000) {
  return routes.filter(route =>
    route.stops?.some(s => s.coords?.lat != null && s.coords?.lng != null &&
      haversineMeters(userLat, userLon, s.coords.lat, s.coords.lng) <= radius
    )
  );
}

function searchStopsByName(query) {
  const q = query.trim().toLowerCase();
  return stops.filter(s => s.name?.hy?.toLowerCase().includes(q));
}

function sendFile(chatId, filePath, caption = '', type = 'document') {
  const finalPath = fs.existsSync(filePath) ? filePath : logoMini;
  if (!fs.existsSync(finalPath)) return;
  const options = { caption };
  const promise = type === 'photo' ? bot.sendPhoto(chatId, fs.createReadStream(finalPath), options) : bot.sendDocument(chatId, fs.createReadStream(finalPath), options);
  return promise;
}

function sendLogo(chatId, type = 'mini', caption = '') { return sendFile(chatId, type === 'large' ? logoLarge : logoMini, caption, 'photo'); }

bot.onText(/\/start/, msg => {
  const chatId = msg.chat.id;
  sendLogo(chatId, 'large', 'Բարև ձեզ, սա HAYQ Way–ն է!').then(() => mainMenu.showMainMenu(bot, chatId));
});

bot.onText(/\/near (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const args = match[1].split(' ');
  if (args.length < 2) return bot.sendMessage(chatId, 'Խնդրում եմ ուղարկեք latitude և longitude: /near <lat> <lon>');
  const userLat = parseFloat(args[0]); const userLon = parseFloat(args[1]);
  if (isNaN(userLat) || isNaN(userLon)) return bot.sendMessage(chatId, 'Խնդրում ենք ճիշտ թվային կոորդինատներ։');

  const { stop, distance } = findNearestStop(userLat, userLon);
  if (!stop) return bot.sendMessage(chatId, 'Ներեցեք, կանգառներ չեն գտնվել։');

  const eta = stop.eta_min != null ? stop.eta_min : estimateETA(userLat, userLon, stop);
  const response = `🚌 Մոտակա կանգառը:\n<b>${stop.name.hy}</b>\nԵրթուղի: ${stop.routeName}\n📍 Հեռավորություն ≈ ${Math.round(distance)} մ\n⏱ մոտավորապես 🔴 <b>${eta} րոպե</b>\n🕒 Ժամանակ: ${stop.time ?? 'Անհայտ'}`;
  bot.sendMessage(chatId, response, { parse_mode: 'HTML' });
});

bot.on('location', msg => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userLat = msg.location.latitude;
  const userLon = msg.location.longitude;

  userLocations[userId] = { lat: userLat, lon: userLon };

  const nearbyRoutes = findRoutesNear(userLat, userLon, 1000);
  if (!nearbyRoutes.length) {
    bot.sendMessage(chatId, 'Ներեցեք, այս շրջանի համար ավտոբուսներ չեն գտնվել։');
    return;
  }

  let messageText = `📍 Ձեր մոտակայքում գտնված ավտոբուսների երթուղիներ (մոտավորապես 1կմ շառավղով):\n`;
  nearbyRoutes.forEach(r => {
    messageText += `🚍 ${r.number}: ${r.start?.hy ?? ''} → ${r.end?.hy ?? ''}\n`;
  });

  bot.sendMessage(chatId, messageText);
});

function sendRouteStopsForUser(chatId, userId, routeNumber, page = 0) {
  const route = routes.find(r => String(r.number) === String(routeNumber) || String(r.id) === String(routeNumber));
  if (!route) return bot.sendMessage(chatId, 'Երթուղի չի գտնվել։');

  const pageSize = 10;
  const start = page * pageSize;
  const stopsPage = (route.stops || []).slice(start, start + pageSize);

  let msg = `🚍 Գիծ ${route.number}: ${route.start?.hy ?? 'Անհայտ'} → ${route.end?.hy ?? 'Անհայտ'}\nԿանգառներ (մաս ${page + 1}):\n`;
  const userLoc = userLocations[userId] ?? {};
  const userLat = userLoc.lat, userLon = userLoc.lon;

  stopsPage.forEach((s, i) => {
    const name = s?.name?.hy ?? 'Անհայտ կանգառ';
    const eta = s?.eta_min && s.eta_min > 0 ? Math.round(s.eta_min) : estimateETA(userLat, userLon, s);
    msg += `${start + i + 1}. ${name} ⏱ մոտավորապես 🔴 <b>${eta} րոպե</b>\n`;
  });

  const buttons = [];
  if (start + pageSize < (route.stops || []).length) buttons.push({ text: 'Հաջորդ', callback_data: `near_next_${route.number}_${page + 1}` });
  if (page > 0) buttons.push({ text: 'Նախորդ', callback_data: `near_prev_${route.number}_${page - 1}` });
  buttons.push({ text: 'Հետ', callback_data: 'near_back' });

  bot.sendMessage(chatId, msg.trim(), { reply_markup: { inline_keyboard: [buttons] }, parse_mode: 'HTML' });
}

bot.on('callback_query', async cq => {
  const { data, message, from } = cq;
  const chatId = message.chat.id;
  const userId = from.id;

  try {
    if (data === 'help') {
      await sendLogo(chatId, 'mini', 'HAYQ Way Օգնություն');
      helpHandler.showHelp(bot, chatId);
    } else if (data === 'route_search') {
      const userLoc = userLocations[userId] ?? {};
      routeMenu.handleRouteSelection(bot, cq, userLoc.lat, userLoc.lon);
    } else if (data === 'send_location') {
      bot.sendMessage(chatId, 'Խնդրում ենք սեղմեք ստորև կոճակը՝ ձեր լոկացիան ուղարկելու համար', {
        reply_markup: {
          keyboard: [[{ text: 'Send My Location', request_location: true }]],
          one_time_keyboard: true,
          resize_keyboard: true
        }
      });
    } else if (data && data.startsWith('near_route_')) {
      const number = data.split('_').slice(2).join('_');
      sendRouteStopsForUser(chatId, userId, number, 0);
    } else if (data && (data.startsWith('near_next_') || data.startsWith('near_prev_'))) {
      const parts = data.split('_');
      const number = parts[2];
      const page = parseInt(parts[3], 10);
      sendRouteStopsForUser(chatId, userId, number, page);
    } else if (data === 'near_back') {
      mainMenu.showMainMenu(bot, chatId);
    }
    await bot.answerCallbackQuery(cq.id);
  } catch (err) {
    await bot.answerCallbackQuery(cq.id, { text: 'Սխալ տեղի ունեցավ, փորձիր նորից։' });
  }
});

bot.on('message', msg => {
  const { chat, text, from } = msg;
  if (!text) return;
  const userId = from.id;

  if (text === '📍 Ուղարկել լոկացիա') {
    bot.sendMessage(chat.id, 'Խնդրում եմ սեղմեք կոճակը և ընտրեք "Share Location" կամ օգտագործեք /near <lat> <lon>։', {
      reply_markup: {
        keyboard: [[{ text: 'Send My Location', request_location: true }]],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
    return;
  }

  if (!text.startsWith('/')) {
    const results = searchStopsByName(text);
    if (results.length) {
      let msgText = `🔎 Գտնված կանգառներ (${results.length}):\n`;
      results.slice(0, 10).forEach((s, i) => {
        msgText += `${i + 1}. ${s.name.hy} 🚍 ${s.routeName}\n`;
      });
      bot.sendMessage(chat.id, msgText, { parse_mode: 'HTML' });
    }
  }
});

log('HAYQ Way Bot is running...', LOG_LEVELS.INFO);
