# Multi-stage lightweight Node.js Dockerfile for Production
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Final minimal production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy dependencies and source from builder
COPY --from=builder --chown=appuser:appgroup /app /app

# Create temp_uploads directory with proper permissions
RUN mkdir -p /app/temp_uploads && chown -R appuser:appgroup /app/temp_uploads

USER appuser

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
