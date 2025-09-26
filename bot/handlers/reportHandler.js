function handleReport(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === 'report_station') {
    bot.sendMessage(chatId, 'Խնդրում ենք մուտքագրել կանգառի անունը կամ խնդիրը:', {
      reply_markup: { force_reply: true }
    }).then(sentMessage => {
      bot.onReplyToMessage(chatId, sentMessage.message_id, (reply) => {
        const userReport = reply.text.trim();
        bot.sendMessage(chatId, `Շնորհակալություն, ձեր հաղորդագրությունը ստացվեց:\n\n"${userReport}"`);
      });
    });
  }
}

module.exports = { handleReport };
