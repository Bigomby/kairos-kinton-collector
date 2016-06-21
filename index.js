const SockJS = require('sockjs-client');
const webstomp = require('webstomp-client');

const ws = new SockJS('http://' + 'ws.kinton.xyz' + ':15674/stomp');
const client = webstomp.over(ws, {
  debug: false,
});

const headers = {
  login: 'guest',
  passcode: 'guest',
  host: '/',
  queue: '/topic/test',
};

client.connect(headers,
  // Connection success
  () => {
    console.log('Connected');
    client.subscribe(headers.queue, (m) => {
      console.log(m.body);
    });
  },
  // Connection error
  () => {
    console.log('Error connecting');
  }
);
