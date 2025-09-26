const { exec } = require('child_process');
const path = require('path');

function startBot() {
  exec('taskkill /F /IM node.exe /T', (err) => {
    if (err) console.log('⚠️ Error killing node processes:', err.message);
    else console.log('✅ Stopped other Node.js processes');

    const botPath = path.join(__dirname, 'bot.js');
    const nodemonProcess = exec(`npx nodemon --watch . --ext js,json "${botPath}"`);

    nodemonProcess.stdout.on('data', (data) => process.stdout.write(data));
    nodemonProcess.stderr.on('data', (data) => process.stderr.write(data));

    nodemonProcess.on('exit', (code) => {
      console.log(`❌ Nodemon bot process exited with code ${code}`);
    });
  });
}

startBot();
