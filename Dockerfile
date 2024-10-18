FROM node:lts-alpine3.20 as base
WORKDIR /app

FROM base as deps
COPY package.json package-lock.json ./

RUN npm ci --omit=dev


FROM deps as devdeps
COPY --from=deps /app .

RUN npm ci


FROM devdeps as builder

COPY tsconfig.json .
COPY --from=devdeps /app .
COPY ./src/ ./src
COPY ./assets/ ./assets/

RUN npx tsc


FROM base as runner

ENV NODE_ENV=production

COPY --from=builder /app/dist ./
COPY --from=deps /app/node_modules ./node_modules/
COPY ./assets/ ./assets/

USER node

EXPOSE 80

CMD ["node", "src/index.js"]
