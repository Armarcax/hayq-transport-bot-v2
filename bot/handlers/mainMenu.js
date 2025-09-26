// mainMenu.js
function showMainMenu(bot, chatId) {
  const keyboard = {
    inline_keyboard: [
      [{ text: '🔍 Գտնել կանգառը', callback_data: 'route_search' }],
      [{ text: '📍 Ուղարկել լոկացիա', callback_data: 'send_location' }],
      [{ text: '❓ Օգնություն', callback_data: 'help' }]
    ]
  };

  bot.sendMessage(chatId, 'Ընտրեք գործողություն՝', {
    reply_markup: keyboard
  });
}

module.exports = { showMainMenu };
