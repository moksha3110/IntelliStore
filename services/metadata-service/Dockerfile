FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY services/metadata-service/package.json ./services/metadata-service/package.json
RUN npm install --workspace=@intellistore/metadata-service --include-workspace-root

FROM base AS build
COPY --from=deps /app /app
COPY tsconfig.base.json ./
COPY services/metadata-service ./services/metadata-service
RUN npm run build --workspace=@intellistore/metadata-service

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/services/metadata-service/dist ./services/metadata-service/dist
COPY --from=build /app/services/metadata-service/package.json ./services/metadata-service/package.json
EXPOSE 4002
CMD ["node", "services/metadata-service/dist/index.js"]
