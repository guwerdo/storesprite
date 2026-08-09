storesprite-be/
├── src/
│   ├── types/
│   │   ├── di.ts                  # Inversify Symbols & Interface contracts
│   │   └── fastify.d.ts           # Type augmentations for Fastify
│   ├── services/
│   │   └── UserService.ts         # Inversify Service implementation
│   ├── routes/
│   │   ├── clerkWebhooks.ts       # Raw body route for Svix webhook verification
│   │   ├── clientApi.ts           # Clerk JWT protected routes
│   │   └── workerApi.ts           # Internal WORKER_TOKEN protected routes
│   ├── plugins/
│   │   ├── inversify.ts           # Custom Fastify decorator for DI Container
│   │   └── socketio.ts            # Socket.IO Fastify plugin
│   ├── app.ts                     # Fastify App Factory (for Server & E2E Tests)
│   └── server.ts                  # Entry point (listens on port 3000)
├── tests/
│   └── workerApi.test.ts          # E2E test using app.inject() + Inversify mocks
├── tsconfig.json
└── package.json