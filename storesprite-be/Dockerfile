FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends docker.io && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace

# Copy shared packages and build them
COPY packages/ /workspace/packages/
WORKDIR /workspace/packages/app-config
RUN npm install && npm run build

# Install and build backend
COPY storesprite-be/package*.json /workspace/storesprite-be/
WORKDIR /workspace/storesprite-be
RUN npm install

COPY storesprite-be/ /workspace/storesprite-be/

EXPOSE 3000
CMD ["sh", "-c", "echo 'To start the service run: npm run dev' && tail -f /dev/null"]
