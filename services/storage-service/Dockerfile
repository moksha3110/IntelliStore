FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY services/storage-service/package.json ./services/storage-service/package.json
RUN npm install --workspace=@intellistore/storage-service --include-workspace-root

FROM base AS build
COPY --from=deps /app /app
COPY tsconfig.base.json ./
COPY services/storage-service ./services/storage-service
RUN npm run build --workspace=@intellistore/storage-service

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/services/storage-service/dist ./services/storage-service/dist
COPY --from=build /app/services/storage-service/package.json ./services/storage-service/package.json
EXPOSE 4003
CMD ["node", "services/storage-service/dist/index.js"]
