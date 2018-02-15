FROM node:9-alpine

MAINTAINER Dylan Richardson <dylanrichardson1996@gmail.com>

RUN apk add --no-cache --virtual .gyp python make g++

COPY . /name-that-tune

WORKDIR /name-that-tune

RUN yarn install --production

RUN apk del .gyp

EXPOSE 3000

CMD yarn start
