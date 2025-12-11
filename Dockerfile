# Multi-stage build for optimized production image

# Stage 1: Build
FROM node:20-alpine AS builder

# Accept build argument for API key
ARG GEMINI_API_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
# Use npm ci if package-lock.json exists, otherwise use npm install
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 2350

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:2350/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
