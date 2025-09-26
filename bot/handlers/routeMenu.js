// routeMenu.js
const fs = require('fs');
const path = require('path');

// Կատարում է էջավորման և ETA հաշվարկ
function estimateETA(userLat, userLon, stop) {
  if (!userLat || !userLon || !stop?.coords?.lat || !stop?.coords?.lng) return 1;
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(stop.coords.lat - userLat);
  const dLon = toRad(stop.coords.lng - userLon);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(userLat)) * Math.cos(toRad(stop.coords.lat)) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  const speed = 50; // մետր/րոպե
  return Math.max(1, Math.round(distance / speed));
}

// Ստեղծում է inline keyboard երթուղիների համար
function createKeyboard(routes) {
  return routes.map(r => ([{
    text: `🚍 ${r.number}: ${r.start.hy ?? 'Անհայտ'} → ${r.end.hy ?? 'Անհայտ'}`,
    callback_data: `show_route_${r.number}`
  }]));
}

// handleRouteSelection – ֆունկցիա որը կանչվում է bot.js-ից
function handleRouteSelection(bot, callbackQuery, userLat, userLon) {
  const chatId = callbackQuery.message.chat.id;
  if (callbackQuery.data !== 'route_search') return;

  const routesPath = path.join(__dirname, '..', '..', 'backend', 'data', 'routes_small_full_with_eta.json');
  let routes;
  try {
    routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
  } catch (err) {
    return bot.sendMessage(chatId, 'Սխալ՝ չկարողացա կարդալ տվյալների ֆայլը 😢');
  }

  bot.sendMessage(chatId, 'Մուտքագրեք կանգառի անունը, ավտոբուսի թիվը կամ պարզապես ուղարկեք Ձեր լոկացիան:', { reply_markup: { force_reply: true } })
    .then(sent => {
      const listener = reply => {
        if (!reply.text && !reply.location) return;
        let foundRoutes = [];

        if (reply.location) {
          const userLat = reply.location.latitude;
          const userLon = reply.location.longitude;
          foundRoutes = routes.filter(r =>
            r.stops?.some(s => s.coords?.lat != null && s.coords?.lng != null &&
              Math.sqrt((s.coords.lat - userLat) ** 2 + (s.coords.lng - userLon) ** 2) <= 0.01
            )
          );
          if (!foundRoutes.length) {
            bot.sendMessage(chatId, 'Ներեցեք, մոտակա երթուղիներ չեն հայտնաբերվել։');
            bot.removeListener('message', listener);
            return;
          }
          bot.sendMessage(chatId, `📍 Մոտակա երթուղիները ձեր գտնվելու վայրի շուրջ՝`, {
            reply_markup: { inline_keyboard: createKeyboard(foundRoutes) }
          });
        } else {
          const input = reply.text.trim().toLowerCase();

          // Եթե մուտքագրել են թիվ – գտնում ենք համապատասխան երթուղիները
          if (/^\d+$/.test(input)) {
            foundRoutes = routes.filter(r => `${r.number}` === input);
          } else {
            // Հաշվի առնում ենք կանգառների անունը և երթուղու սկզբն/վերջանունները
            foundRoutes = routes.filter(r =>
              (r.start?.hy?.toLowerCase().includes(input)) ||
              (r.end?.hy?.toLowerCase().includes(input)) ||
              r.stops?.some(s => s.name?.hy?.toLowerCase().includes(input))
            );
          }

          if (!foundRoutes.length) {
            bot.sendMessage(chatId, `Ներեցեք, ոչինչ չի գտնվել։`);
            bot.removeListener('message', listener);
            return;
          }

          const greetings = [
            'Ահա կանգառների ցուցակը՝',
            'Նայիր այս երթուղիները՝',
            'Եկ, տեսնենք կանգառները՝',
            'Բր, ահա թարմացրած կանգառները՝'
          ];
          bot.sendMessage(chatId, `${greetings[Math.floor(Math.random() * greetings.length)]} «${reply.text}»–ում անցնող երթուղիները՝`, {
            reply_markup: { inline_keyboard: createKeyboard(foundRoutes) }
          });
        }

        bot.removeListener('message', listener);

        // pagination callback
        const pageHandler = cq => {
          const data = cq.data;
          if (!data.startsWith('show_route_') &&
              !data.startsWith('next_') &&
              !data.startsWith('prev_') &&
              data !== 'back_routes') return;

          let routeNumber, page;
          if (data.startsWith('show_route_')) {
            routeNumber = data.replace('show_route_', '');
            page = 0;
          } else if (data.startsWith('next_') || data.startsWith('prev_')) {
            const parts = data.split('_');
            routeNumber = parts[1];
            page = parseInt(parts[2], 10);
          }

          const route = foundRoutes.find(r => `${r.number}` === `${routeNumber}`);
          if (!route) return;

          const pageSize = 10;
          const start = page * pageSize;
          const stopsPage = route.stops.slice(start, start + pageSize);

          let msg = `🚍 Գիծ ${route.number}: ${route.start.hy ?? 'Անհայտ'} → ${route.end.hy ?? 'Անհայտ'}\nԿանգառներ (մաս ${page + 1}):\n`;
          stopsPage.forEach((s, i) => {
            const eta = (userLat && userLon)
              ? estimateETA(userLat, userLon, s)
              : (s?.eta_min || 1);
            msg += `${start + i + 1}. ${s.name?.hy ?? 'Անհայտ կանգառ'} ⏱ մոտավորապես 🔴 <b>${eta} րոպե</b>\n`;
          });

          const buttons = [];
          if (start + pageSize < route.stops.length)
            buttons.push({ text: 'Հաջորդ', callback_data: `next_${route.number}_${page + 1}` });
          if (page > 0)
            buttons.push({ text: 'Նախորդ', callback_data: `prev_${route.number}_${page - 1}` });
          buttons.push({ text: 'Հետ', callback_data: 'back_routes' });

          bot.sendMessage(cq.message.chat.id, msg.trim(), {
            reply_markup: { inline_keyboard: [buttons] },
            parse_mode: 'HTML'
          });
          bot.answerCallbackQuery(cq.id);
        };

        if (!bot._routeMenuRegistered) {
          bot.on('callback_query', pageHandler);
          bot._routeMenuRegistered = true;
        }
      };

      bot.on('message', listener);
    });
}

module.exports = { handleRouteSelection, estimateETA };
