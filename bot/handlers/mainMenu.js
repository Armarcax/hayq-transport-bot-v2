// handlers/mainMenu.js
function showMainMenu(bot, chatId) {
  const keyboard = [
    [{ text: '📍 Ուղարկել լոկացիա' }],
    [{ text: '🔎 Որոնել կանգառ' }],
    [{ text: 'ℹ Օգնություն', callback_data: 'help' }]
  ];
  bot.sendMessage(chatId, 'Ընտրեք գործողությունը:', {
    reply_markup: {
      keyboard,
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
}

module.exports = { showMainMenu };
