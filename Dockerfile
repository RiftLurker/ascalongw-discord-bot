FROM node:lts-alpine3.20 AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./

RUN npm ci --omit=dev


FROM deps AS devdeps
COPY --from=deps /app .

RUN npm ci


FROM devdeps AS builder

COPY tsconfig.json .
COPY --from=devdeps /app .
COPY ./src/ ./src
COPY ./assets/ ./assets/

RUN npx tsc


FROM base AS runner

ENV NODE_ENV=production

COPY --from=builder /app/dist ./
COPY --from=deps /app/node_modules ./node_modules/
COPY --from=deps /app/package.json ./
COPY ./assets/ ./assets/

USER node

EXPOSE 80

CMD ["node", "src/index.js"]
