FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY services/replication-service/package.json ./services/replication-service/package.json
RUN npm install --workspace=@intellistore/replication-service --include-workspace-root

FROM base AS build
COPY --from=deps /app /app
COPY tsconfig.base.json ./
COPY services/replication-service ./services/replication-service
RUN npm run build --workspace=@intellistore/replication-service

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/services/replication-service/dist ./services/replication-service/dist
COPY --from=build /app/services/replication-service/package.json ./services/replication-service/package.json
EXPOSE 4004
CMD ["node", "services/replication-service/dist/index.js"]
