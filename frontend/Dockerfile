FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Empty base = same-origin relative fetches; Caddy routes /api + /tools to the backend.
# NEXT_PUBLIC_* is baked in at build time, so this must be set BEFORE npm run build.
ENV NEXT_PUBLIC_API_BASE=""
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
