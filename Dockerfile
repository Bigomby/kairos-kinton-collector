FROM node:6.2-slim

ADD . /app

WORKDIR /app

RUN npm install

CMD ["node", "."]
