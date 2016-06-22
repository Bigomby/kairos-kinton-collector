const stompit = require('stompit');
const winston = require('winston');
const influxdb = require('influx');

const deviceUUID = process.env.KINTON_HUB_UUID;

const logger = new(winston.Logger)({
  transports: [new(winston.transports.Console)({
    level: 'debug',
    colorize: true,
    prettyPrint: true,
  })],
});

const influx = influxdb({
  host: 'influxdb',
  port: 8086,
  username: 'root',
  password: 'root',
  database: 'kairos',
});

const connectOptions = {
  host: 'stream.kinton.xyz',
  port: 61613,
  connectHeaders: {
    host: '/',
    login: 'guest',
    passcode: 'guest',
  },
};

if (!deviceUUID) {
  logger.error('No KINTON_HUB_UUID defined');
  process.exit(1);
}

stompit.connect(connectOptions, (error, stomp) => {
  if (error) {
    logger.error(`connect error ${error.message}`);
    return;
  }

  const headers = {
    destination: `/topic/${deviceUUID}.kairos`,
    ack: 'client-individual',
    persistent: 'true',
  };

  stomp.subscribe(headers, (suscribeError, message) => {
    if (error) {
      logger.info(`subscribe error ${suscribeError.message}`);
      return;
    }

    message.readString('utf-8', (readStringError, body) => {
      if (error) {
        logger.info(`read message error ${readStringError.message}`);
        stomp.ack(message);
        return;
      }

      try {
        const data = JSON.parse(body);

        if (!data.readings || data.readings instanceof Array === false) {
          logger.error('No readings on received data');
          return;
        }

        for (const reading of data.readings) {
          if (typeof reading === 'object' && typeof reading.value === 'number') {
            const points = [
              [{
                value: reading.value,
              }],
            ];

            if (reading.type) {
              influx.writePoints(reading.type, points, [], (err) => {
                if (err) {
                  logger.error(err);
                  return;
                }
              });
            } else {
              logger.error('Unknown type');
            }
          } else {
            logger.error('Wrong value (not number)');
          }
        }
      } catch (e) {
        logger.error(e);
      } finally {
        stomp.ack(message);
      }
    });
  });
});
