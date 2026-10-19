FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
FROM dependencies AS build
COPY . .
ARG NEXT_PUBLIC_TENANT_PORTAL_PORT=8091
ENV NEXT_PUBLIC_TENANT_PORTAL_PORT=$NEXT_PUBLIC_TENANT_PORTAL_PORT
RUN npm run build
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3005 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3005
CMD ["node", "server.js"]
