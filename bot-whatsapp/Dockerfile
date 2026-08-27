FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY index.js supabase-auth-state.js organization-isolation.js session-lifecycle.js session-operation-queue.js README.md ./

USER node
EXPOSE 10000
CMD ["node", "index.js"]
