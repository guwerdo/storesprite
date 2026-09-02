FROM node:24-slim
WORKDIR /workspace

# The frontend depends on @storesprite/mapping-rules via a file: dependency
# (file:../packages/mapping-rules). Resolve from the repo-root build context.
COPY packages/mapping-rules/package*.json /packages/mapping-rules/
COPY packages/mapping-rules/tsconfig*.json /packages/mapping-rules/
COPY packages/mapping-rules/src /packages/mapping-rules/src
RUN cd /packages/mapping-rules && npm install && npm run build

# Install and run the frontend (build context = repo root).
COPY storesprite-fe/package*.json ./
RUN npm install
COPY storesprite-fe/ ./

EXPOSE 5173
CMD ["sh", "-c", "npm run start:dev & tail -f /dev/null"]
