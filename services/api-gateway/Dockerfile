FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY services/api-gateway/package.json ./services/api-gateway/package.json
RUN npm install --workspace=@intellistore/api-gateway --include-workspace-root

FROM base AS build
COPY --from=deps /app /app
COPY tsconfig.base.json ./
COPY services/api-gateway ./services/api-gateway
RUN npm run build --workspace=@intellistore/api-gateway

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/services/api-gateway/dist ./services/api-gateway/dist
COPY --from=build /app/services/api-gateway/package.json ./services/api-gateway/package.json
EXPOSE 4000
CMD ["node", "services/api-gateway/dist/index.js"]
