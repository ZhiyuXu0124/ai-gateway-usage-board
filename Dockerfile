FROM node:22-bullseye-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3001
EXPOSE 5173

CMD ["npm", "run", "dev"]
