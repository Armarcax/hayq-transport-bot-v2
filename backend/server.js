const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const routeRoutes = require('./routes/routes');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use('/routes', routeRoutes);

// Health check
app.get('/ping', (req, res) => {
  res.json({ status: 'ok', message: 'pong' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
