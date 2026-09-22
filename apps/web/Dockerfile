# Phase 0 placeholder: runs the Next.js dev server for local docker-compose.
# A production multi-stage build is added in Phase 10.
FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
