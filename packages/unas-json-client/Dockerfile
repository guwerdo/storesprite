FROM node:24-slim
WORKDIR /workspace

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

CMD ["sh", "-c", "echo 'UNAS JSON Client Dev Container ready' && tail -f /dev/null"]
