FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY services/notification-service/package.json ./services/notification-service/package.json
RUN npm install --workspace=@intellistore/notification-service --include-workspace-root

FROM base AS build
COPY --from=deps /app /app
COPY tsconfig.base.json ./
COPY services/notification-service ./services/notification-service
RUN npm run build --workspace=@intellistore/notification-service

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/services/notification-service/dist ./services/notification-service/dist
COPY --from=build /app/services/notification-service/package.json ./services/notification-service/package.json
EXPOSE 4006
CMD ["node", "services/notification-service/dist/index.js"]
