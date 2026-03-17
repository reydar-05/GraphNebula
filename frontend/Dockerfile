# ─── Stage 1: node builder ───────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci --prefer-offline

# Build production bundle
COPY . .
# VITE_API_BASE_URL is injected at build time via --build-arg
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

# ─── Stage 2: nginx runtime ──────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Custom nginx config for SPA routing + API proxy
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
