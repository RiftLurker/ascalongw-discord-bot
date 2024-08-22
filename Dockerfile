FROM alpine:3.20

WORKDIR /app

RUN apk update && apk add bash nodejs npm

COPY . /app

RUN npm install \
&& npx tsc -p tsconfig.json \
&& cp -ura assets/* dist/assets

EXPOSE 80

CMD ["sh","-c","cp -ura config.json dist/config.json && /usr/bin/node --expose-gc dist/src/index.js"]