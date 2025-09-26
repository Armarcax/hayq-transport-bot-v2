function showHelp(bot, chatId) {
  const message = `
Բարի գալուստ HAYQ Way բոտ:

🚍 **Ընտրել երթուղի** – ընտրիր կանգառ ու տես ավտոբուսների համարները:
ℹ️ **Օգնություն / Help** – սա հաղորդագրությունն է, որ դու կարդում ես հիմա 😎

Հետադարձ կապի համար կարող ես գրել մեզ քո առաջարկներն ու խնդիրները:
`;
  bot.sendMessage(chatId, message);
}

module.exports = { showHelp };
