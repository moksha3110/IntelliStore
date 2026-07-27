FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN npm install --workspace=@intellistore/web --include-workspace-root
RUN npm run build --workspace=@intellistore/shared-types
RUN npm run build --workspace=@intellistore/web

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, not
# read at container runtime. The defaults baked into the source
# (http://localhost:<port>) target the same ports used in local dev, so this
# image works out of the box when each backend service is port-forwarded to
# its standard port for browser access. A real deployment would rebuild with
# NEXT_PUBLIC_* values pointing at public URLs (or better, route everything
# through a single API gateway / ingress origin).
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
