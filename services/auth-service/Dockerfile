FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY services/auth-service/package.json ./services/auth-service/package.json
RUN npm install --workspace=@intellistore/auth-service --include-workspace-root

FROM base AS build
COPY --from=deps /app /app
COPY tsconfig.base.json ./
COPY services/auth-service ./services/auth-service
RUN npm run build --workspace=@intellistore/auth-service

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/services/auth-service/dist ./services/auth-service/dist
COPY --from=build /app/services/auth-service/package.json ./services/auth-service/package.json
EXPOSE 4001
CMD ["node", "services/auth-service/dist/index.js"]
