# Stage 1: Build the Angular app
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Production build — emits to dist/frontend/browser via the
# @angular-devkit/build-angular:application builder.
RUN npm run build -- --configuration production

# Stage 2: Serve the static bundle via nginx
FROM nginx:alpine

# BACKEND_URL is the full https://…run.app URL of the Cloud Run backend.
# It gets baked into nginx.conf so /api/* is reverse-proxied to the backend.
ARG BACKEND_URL=""

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

# Substitute the backend URL + host into the nginx config at build time.
RUN set -eux; \
    if [ -z "$BACKEND_URL" ]; then \
      echo "BACKEND_URL build-arg is required"; exit 1; \
    fi; \
    BACKEND_HOST=$(printf '%s' "$BACKEND_URL" | sed -E 's#^https?://##; s#/.*$##'); \
    sed -i "s|__BACKEND_URL__|${BACKEND_URL}|g" /etc/nginx/conf.d/default.conf; \
    sed -i "s|__BACKEND_HOST__|${BACKEND_HOST}|g" /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
