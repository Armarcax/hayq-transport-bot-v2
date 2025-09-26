const express = require('express');
const router = express.Router();
const routes = require('../data/routes.json');

router.get('/ping', (req, res) => {
  res.json({ module: 'routes', status: 'ok' });
});

router.get('/', (req, res) => {
  res.json(routes);
});

router.get('/find/:stop', (req, res) => {
  const stopName = decodeURIComponent(req.params.stop);
  const found = routes.filter(r => r.stops.includes(stopName));
  res.json(found);
});

module.exports = router;
