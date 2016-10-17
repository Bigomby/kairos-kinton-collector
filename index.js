const express = require('express');
const bodyParser = require('body-parser');
const stompit = require('stompit');
const winston = require('winston');
const requestify = require('requestify');

const LISTENING_PORT = process.env.LISTENING_PORT || '8080';
const KINTON_HOST = process.env.KINTON_HOST || 'stream.kinton.xyz';
const KINTON_PORT = process.env.PORT || 61613;
const FLEET_KEY = process.env.FLEET_KEY;
const IFTTT_API_KEY = process.env.IFTTT_API_KEY;

const app = express();
app.use(bodyParser.json());
const logger = new(winston.Logger)({
  transports: [new(winston.transports.Console)({
    level: 'debug',
    colorize: true,
    prettyPrint: true,
  }),
],
});

let currentStatus = 'timer';

// STOMP Connection options
const connectOptions = {
  host: KINTON_HOST,
  port: KINTON_PORT,
  connectHeaders: {
    host: '/',
    login: 'admin', // TODO Use APP_KEY
    passcode: '', // TODO Use APP_SECRET
  },
};

// Connect to Kinton via STOMP
stompit.connect(connectOptions, (connectionError, stomp) => {
  if (connectionError) throw connectionError;
  logger.info('Connected to Kinton');

  // Subscribe to lights events
  stomp.subscribe({
    destination: `/amq/queue/${FLEET_KEY}`, // Queue to connect
  }, (subscriptionError, message) => {
    if (subscriptionError) throw subscriptionError;

    message.readString('utf-8', (readStringError, data) => {
      if (readStringError) throw readStringError;

      const date = new Date(message.headers.timestamp * 1000);
      const parsed = JSON.parse(data);

      if (parsed.device === 'climatizer') {
        logger.info('----------------------------------------------------------');
        logger.info(`MESSAGE UUID: ${message.headers['amqp-message-id']}`);
        logger.info(`DATA: ${data}`);
        logger.info(`TOPIC: ${message.headers.topic}`);
        logger.info(`TIMESTAMP: ${date.toLocaleString()}`);

        requestify.post(`https://maker.ifttt.com/trigger/sun/with/key/${IFTTT_API_KEY}`, {
          value1: parsed.light,
        }).then((response) => { if (response.code >= 400) throw response.body; });
      }
    });
  });

  app.post('/api/sun', (req, res) => {
    if (!req.body.fleet || !req.body.device || !req.body.action) {
      return;
    }

    logger.debug(req.body);
    const frame = stomp.send({
      destination: `/topic/${req.body.fleet}.${req.body.device}`,
      'content-type': 'text/plain',
    });

    switch (req.body.action) {
      case 'toggle':
        if (currentStatus === 'on') {
          frame.write('{"element": "sun", "action":"set", "value": "off"}');
          currentStatus = 'off';
        } else {
          frame.write('{"element": "sun", "action":"set", "value": "off"}');
          currentStatus = 'on';
        }
        break;

      default:
        logger.warn(`Unknown command: ${req.body.action}`);
        break;
    }

    frame.end();
    res.end();
  });

  app.post('/api/rain', (req, res) => {
    if (!req.body.fleet || !req.body.device || !req.body.action) {
      return;
    }

    logger.debug(req.body);
    const frame = stomp.send({
      destination: `/topic/${req.body.fleet}.${req.body.device}`,
      'content-type': 'text/plain',
    });

    switch (req.body.action) {
      case 'water':
        frame.write('{"element": "rain", "action":"water"');
        break;

      default:
        logger.warn(`Unknown command: ${req.body.action}`);
        break;
    }

    frame.end();
    res.end();
  });

  app.listen(LISTENING_PORT, () => {
    logger.info(`Listening on port ${LISTENING_PORT}`);
  });
});
