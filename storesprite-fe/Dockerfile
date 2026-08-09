FROM node:24-slim
WORKDIR /workspace
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["sh", "-c", "echo 'To start the service run: npm run dev' && tail -f /dev/null"]
