FROM node:16.5.0 AS builder
WORKDIR /project/
COPY . .
RUN npm ci
RUN npm run build
RUN npm prune --production
ENTRYPOINT [ "npm", "start" ]


FROM node:16.5.0
WORKDIR /project/
COPY --from=builder /project/build/ ./build
COPY --from=builder /project/config/ ./config
COPY --from=builder /project/node_modules/ ./node_modules
COPY --from=builder /project/.git/refs ./.git/refs
COPY --from=builder /project/package.json/ ./package.json
ENTRYPOINT [ "npm", "start" ]
