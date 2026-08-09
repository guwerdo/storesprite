storesprite-fe/
├── src/
│   ├── di/
│   │   ├── types.ts              # Symbol identifiers
│   │   ├── interfaces.ts         # Strictly typed service contracts
│   │   ├── container.ts          # Inversify DI Container setup
│   │   └── InversifyContext.tsx  # React Context & useInjection hook
│   ├── services/
│   │   ├── ApiClient.ts          # Axios wrapper injecting Clerk JWT
│   │   ├── SyncSocketService.ts  # Socket.IO connection manager
│   │   └── JobService.ts         # Service handling job triggers & configs
│   ├── components/
│   │   └── SyncControl.tsx       # Consumes IJobService & ISyncSocket
│   ├── App.tsx
│   └── main.tsx