FROM node:24-slim
WORKDIR /workspace
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["sh", "-c", "npm run start:dev & tail -f /dev/null"]
