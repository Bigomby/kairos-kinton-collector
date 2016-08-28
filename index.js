const stompit = require('stompit');
const winston = require('winston');

const KINTON_HOST = process.env.KINTON_HOST || 'stream.kinton.xyz';
const KINTON_PORT = process.env.PORT || 61613;
const FLEET_KEY = process.env.FLEET_KEY || 'b193020b-8cb0-46ae-a91e-53f33ac07afc';
// const APP_KEY = '';
// const APP_SECRET = '';

const logger = new(winston.Logger)({
  transports: [new(winston.transports.Console)({
    level: 'debug',
    colorize: true,
    prettyPrint: true,
  })],
});

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

  // Subscribe to our fleet
  stomp.subscribe({
    destination: `/amq/queue/${FLEET_KEY}`, // Queue to connect
    ack: 'client-individual',               // Manual ACK per message
  }, (subscriptionError, message) => {
    if (subscriptionError) throw subscriptionError;
    stomp.ack(message);

    message.readString('utf-8', (readStringError, data) => {
      if (readStringError) throw readStringError;

      const date = new Date(message.headers.timestamp * 1000);
      logger.info('----------------------------------------------------------');
      logger.info(`MESSAGE UUID: ${message.headers['amqp-message-id']}`);
      logger.info(`DATA: ${data}`);
      logger.info(`TOPIC: ${message.headers.topic}`);
      logger.info(`TIMESTAMP: ${date.toLocaleString()}`);
    });
  });
});
