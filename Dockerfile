FROM node:9-slim

COPY . /name-that-tune
COPY package.json /name-that-tune/package.json
COPY .env /name-that-tune/.env

WORKDIR /name-that-tune

ENV NODE_ENV production
RUN npm install --production

CMD ["npm", "start"]

EXPOSE 8888
