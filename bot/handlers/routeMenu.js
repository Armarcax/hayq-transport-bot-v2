// handlers/routeMenu.js
const fs = require('fs');
const path = require('path');

// --- Հեռավորության հաշվարկ Haversine ---
function toRad(d) { return d * Math.PI / 180; }
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const phi1 = toRad(lat1), phi2 = toRad(lat2);
  const dphi = toRad(lat2 - lat1), dlambda = toRad(lon2 - lon1);
  const a = Math.sin(dphi/2)**2 + Math.cos(phi1)*Math.cos(phi2)*Math.sin(dlambda/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- ETA հաշվարկ ---
function estimateETA(userLat, userLon, stop) {
  if (!userLat || !userLon || !stop?.coords?.lat || !stop?.coords?.lng) return 1;
  const distance = haversineMeters(userLat, userLon, stop.coords.lat, stop.coords.lng);
  const speed = 50; // մետր/րոպե
  return Math.max(1, Math.round(distance / speed));
}

// --- Ստեղծում inline keyboard ---
function createKeyboard(routes) {
  return routes.map(r => ([{
    text: `🚍 ${r.number}: ${r.start?.hy ?? 'Անհայտ'} → ${r.end?.hy ?? 'Անհայտ'}`,
    callback_data: `route_${r.number}_page_0`
  }]));
}

// --- Գտնել վերջին JSON ֆայլը ---
function getLatestJSONFile() {
  const dataDir = path.join(__dirname, '..', '..', 'backend', 'data');
  if (!fs.existsSync(dataDir)) return null;
  const files = fs.readdirSync(dataDir)
    .filter(f => f.endsWith('.json') && f.includes('routes_small_full_with_eta'))
    .map(f => ({ name: f, time: fs.statSync(path.join(dataDir, f)).mtime.getTime() }));
  if (!files.length) return null;
  files.sort((a,b) => b.time - a.time);
  return path.join(dataDir, files[0].name);
}

// --- Pagination ֆունկցիա կանգառների ցուցադրության համար ---
function sendStops(bot, chatId, userLat, userLon, route, page = 0) {
  const pageSize = 10;
  const start = page * pageSize;
  const stopsPage = Array.isArray(route.stops) ? route.stops.slice(start, start + pageSize) : [];

  let msg = `🚍 Գիծ ${route.number}: ${route.start?.hy ?? 'Անհայտ'} → ${route.end?.hy ?? 'Անհայտ'}\nԿանգառներ (մաս ${page + 1}):\n\n`;
  stopsPage.forEach((s, i) => {
    const name = s?.name?.hy ?? 'Անհայտ կանգառ';
    let eta = (s?.eta_min && s.eta_min > 0) ? Math.round(s.eta_min) : estimateETA(userLat, userLon, s);
    if (eta <= 0) eta = 1;
    msg += `${start + i + 1}. ${name} 🔴 ⏱ մոտավորապես <b>${eta} րոպե</b>\n`;
  });

  const buttons = [];
  if (start + pageSize < (route.stops?.length || 0))
    buttons.push({ text: 'Հաջորդ', callback_data: `route_${route.number}_page_${page + 1}` });
  if (page > 0)
    buttons.push({ text: 'Նախորդ', callback_data: `route_${route.number}_page_${page - 1}` });
  buttons.push({ text: 'Հետ', callback_data: 'back_routes' });

  bot.sendMessage(chatId, msg.trim(), { reply_markup: { inline_keyboard: [buttons] }, parse_mode: 'HTML' });
}

// --- User session object՝ անհատական listener–ների համար ---
const userSessions = {};

// --- ՄAIN ֆունկցիա route ընտրության համար ---
function handleRouteSelection(bot, callbackQuery, userLat, userLon) {
  const chatId = callbackQuery.message.chat.id;
  if (callbackQuery.data !== 'route_search') return;

  const routesPath = getLatestJSONFile();
  if (!routesPath) return bot.sendMessage(chatId, 'Սխալ՝ տվյալների ֆայլը չի գտնվել 😢');

  let routes;
  try { routes = JSON.parse(fs.readFileSync(routesPath, 'utf8')); }
  catch (err) { console.error('routeMenu: JSON parse error', err); return bot.sendMessage(chatId, 'Սխալ՝ JSON կարդալ չհաջողվեց 😢'); }

  bot.sendMessage(chatId, 'Մուտքագրեք կանգառի անունը, ավտոբուսի թիվը կամ ուղարկեք ձեր լոկացիան:', { reply_markup: { force_reply: true } })
    .then(sent => {
      bot.onReplyToMessage(chatId, sent.message_id, reply => {
        if (!reply) return;
        let localLat = userLat, localLon = userLon;
        let foundRoutes = [];

        // --- Լոկացիա ---
        if (reply.location) {
          localLat = reply.location.latitude;
          localLon = reply.location.longitude;
          const radius = 1000;
          foundRoutes = routes.filter(r =>
            Array.isArray(r.stops) && r.stops.some(s =>
              s.coords?.lat != null && s.coords?.lng != null &&
              haversineMeters(localLat, localLon, s.coords.lat, s.coords.lng) <= radius
            )
          );
          if (!foundRoutes.length) {
            bot.sendMessage(chatId, 'Ներեցեք, մոտակա երթուղիներ չեն հայտնաբերվել։');
            return;
          }
          bot.sendMessage(chatId, `📍 Մոտակա երթուղիները ձեր գտնվելու վայրի շուրջ՝`, { reply_markup: { inline_keyboard: createKeyboard(foundRoutes) } });
        } else {
          // --- Տեքստային որոնում ---
          const input = (reply.text || '').trim().toLowerCase();
          if (!input) { bot.sendMessage(chatId, 'Խնդրում եմ մուտքագրեք ճիշտ տեքստ։'); return; }
          if (/^\d+$/.test(input)) {
            foundRoutes = routes.filter(r => String(r.number) === input || String(r.id) === input);
          } else {
            foundRoutes = routes.filter(r =>
              (r.start?.hy?.toLowerCase().includes(input)) ||
              (r.end?.hy?.toLowerCase().includes(input)) ||
              (Array.isArray(r.stops) && r.stops.some(s => s.name?.hy?.toLowerCase().includes(input)))
            );
          }
          if (!foundRoutes.length) {
            bot.sendMessage(chatId, `Ներեցեք, ոչինչ չի գտնվել։`);
            return;
          }
          const greetings = ['Ահա կանգառների ցուցակը՝', 'Նայիր այս երթուղիները՝', 'Եկ, տեսնենք կանգառները՝', 'Տես այս երթուղիները՝'];
          const greeting = greetings[Math.floor(Math.random()*greetings.length)];
          bot.sendMessage(chatId, `${greeting} «${reply.text}»–ում անցնող երթուղիները՝`, { reply_markup: { inline_keyboard: createKeyboard(foundRoutes) } });
        }

        // --- Սինխրոն callback listener միայն այս user-ի համար ---
        const userId = reply.from.id;
        if (userSessions[userId]?.callbackHandler)
          bot.removeListener('callback_query', userSessions[userId].callbackHandler);

        const handler = cq => {
          const data = cq.data;
          if (!data) return;
          if (data === 'back_routes') {
            bot.removeListener('callback_query', handler);
            delete userSessions[userId];
            bot.answerCallbackQuery(cq.id);
            return;
          }
          if (!data.startsWith('route_')) return;

          const parts = data.split('_'); // route_{number}_page_{n}
          const routeNumber = parts[1];
          const page = parseInt(parts[3] || '0', 10);
          const route = foundRoutes.find(r => String(r.number) === routeNumber || String(r.id) === routeNumber);
          if (!route) { bot.answerCallbackQuery(cq.id, { text: 'Երթուղի չի գտնվել։' }); return; }

          sendStops(bot, cq.message.chat.id, localLat, localLon, route, page);
          bot.answerCallbackQuery(cq.id);
        };

        bot.on('callback_query', handler);
        userSessions[userId] = { callbackHandler: handler };

        // Ավտոմատ հանվող timeout 5 րոպե
        setTimeout(() => {
          try { bot.removeListener('callback_query', handler); delete userSessions[userId]; } catch(e) {}
        }, 5*60*1000);
      });
    })
    .catch(err => {
      console.error('routeMenu.sendMessage failed', err);
      bot.sendMessage(chatId, 'Սխալ, փորձեք կրկին։');
    });
}

module.exports = { handleRouteSelection, estimateETA };
