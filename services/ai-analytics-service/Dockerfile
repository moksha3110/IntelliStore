FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY services/ai-analytics-service/package.json ./services/ai-analytics-service/package.json
RUN npm install --workspace=@intellistore/ai-analytics-service --include-workspace-root

FROM base AS build
COPY --from=deps /app /app
COPY tsconfig.base.json ./
COPY services/ai-analytics-service ./services/ai-analytics-service
RUN npm run build --workspace=@intellistore/ai-analytics-service

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/services/ai-analytics-service/dist ./services/ai-analytics-service/dist
COPY --from=build /app/services/ai-analytics-service/package.json ./services/ai-analytics-service/package.json
EXPOSE 4005
CMD ["node", "services/ai-analytics-service/dist/index.js"]
