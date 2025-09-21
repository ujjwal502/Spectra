# Multi-stage Docker build to produce a small runtime image without source code

# 1) Builder: install dev deps and compile TypeScript to dist/
FROM node:20 AS builder
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy sources and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# 2) Runtime: only production deps + compiled JS
FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Install runtime tools needed by curlRunner (curl for HTTP, certs for HTTPS)
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates bash \
  && rm -rf /var/lib/apt/lists/*

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Default entrypoint: expose CLI; pass subcommands/args at `docker run ... <args>`
ENTRYPOINT ["node", "dist/src/cli/enhanced.js"]
CMD ["info"]
