// searchMenu.js – Թարմացված տարբերակ

function askForNumber(bot, chatId, callback) {
  bot.sendMessage(chatId, 'Մուտքագրեք ավտոբուսի համարը (միայն թիվ):');
  const listener = msg => {
    if (!msg.text) return;
    const number = msg.text.trim();
    if (!/^\d+$/.test(number)) {
      bot.sendMessage(chatId, 'Խնդրում ենք մուտքագրել միայն թիվ։');
      return;
    }
    bot.removeListener('message', listener);
    callback(number);
  };
  bot.on('message', listener);
}

function askForText(bot, chatId, label, callback) {
  bot.sendMessage(chatId, `Մուտքագրեք ${label}:`);
  const listener = msg => {
    if (!msg.text) return;
    const text = msg.text.trim();
    bot.removeListener('message', listener);
    callback(text);
  };
  bot.on('message', listener);
}

function handleSearch(bot, callbackQuery, userLat, userLon) {
  const chatId = callbackQuery.message.chat.id;

  bot.sendMessage(chatId, 'Ընտրեք որոնման ձևը:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔢 Ավտոբուսի համար', callback_data: 'search_by_number' }],
        [{ text: '🛣️ Երթուղու անվանում', callback_data: 'search_by_route' }],
        [{ text: '🚏 Կանգառի անվանում', callback_data: 'search_by_stop' }]
      ]
    }
  });

  bot.once('callback_query', cq => {
    bot.answerCallbackQuery(cq.id);
    if (cq.data === 'search_by_number') {
      askForNumber(bot, chatId, number => {
        const found = searchByBusNumber(number);
        return showRouteResults(bot, chatId, found, userLat, userLon);
      });
    }
    if (cq.data === 'search_by_route') {
      askForText(bot, chatId, 'երթուղու անվանումը', text => {
        const found = searchByRouteName(text);
        return showRouteResults(bot, chatId, found, userLat, userLon);
      });
    }
    if (cq.data === 'search_by_stop') {
      askForText(bot, chatId, 'կանգառի անվանումը', text => {
        const found = searchByStopName(text);
        return showStopResults(bot, chatId, found, userLat, userLon);
      });
    }
  });
}

// Ցուցադրում է կանգառների արդյունքները 10 հատով էջերով
function showStopResults(bot, chatId, stops, userLat, userLon, page = 0) {
  if (!stops.length) return bot.sendMessage(chatId, 'Ոչինչ չի գտնվել։');

  const pageSize = 10;
  const start = page * pageSize;
  const pageStops = stops.slice(start, start + pageSize);

  let text = `🚏 Գտնված կանգառներ (մաս ${page+1}):\n`;
  pageStops.forEach((s, i) => {
    let eta = s?.eta_min && s.eta_min > 0 ? Math.round(s.eta_min) : 1;
    text += `${start + i + 1}. ${s.name?.hy ?? 'Անհայտ'} 🔴 ⏱ մոտավորապես <b>${eta} րոպե</b>\n🚍 ${s.routeName}\n\n`;
  });

  const buttons = [];
  if (start + pageSize < stops.length)
    buttons.push({ text: 'Հաջորդ', callback_data: `stop_next_${page+1}` });
  if (page > 0)
    buttons.push({ text: 'Նախորդ', callback_data: `stop_prev_${page-1}` });

  bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [buttons] }
  });

  bot.once('callback_query', cq => {
    if (!cq.data.startsWith('stop_')) return;
    bot.answerCallbackQuery(cq.id);
    const newPage = parseInt(cq.data.split('_')[2], 10);
    showStopResults(bot, chatId, stops, userLat, userLon, newPage);
  });
}

module.exports = { handleSearch };
