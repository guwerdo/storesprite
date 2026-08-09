# storesprite-fe (Frontend Service)

The single-page web client for StoreSprite built with **React**, **Vite**, **TypeScript**, **Material-UI (MUI v6)**, `@clerk/clerk-react`, and **InversifyJS**.

---

## 1. Developer Execution Commands

After launching the Docker container stack via `docker compose up -d`, enter the container terminal or DevContainer session and execute:

* **Start Development Server** (Hot Reloading):
  ```bash
  npm run dev
  ```
  *Binds to `http://0.0.0.0:5173` so Vite is accessible from your host browser at `http://localhost:5173/`.*

* **Run Unit Tests**:
  ```bash
  npm test
  ```
  *Runs the Vitest test suite (`vitest run`).*

* **Build Production Bundle**:
  ```bash
  npm run build
  ```
  *Runs TypeScript typecheck (`tsc`) and bundles optimized static assets into the `dist/` folder.*

* **Run Compiled Release Build**:
  ```bash
  npm run rel
  ```
  *Serves the compiled production bundle from `dist/` via `vite preview --host` on port `5173`.*

---

## 2. Accessing Clerk-Protected Backend Endpoints

The frontend uses `@clerk/clerk-react` to handle user authentication sessions.

### A. Making Authenticated API Calls from React Components
Always use the `useAuth()` hook provided by Clerk to retrieve the user's active session token, then attach it as a `Bearer` token in the `Authorization` header:

```typescript
import { useAuth } from '@clerk/clerk-react';

export function UserProfileComponent() {
  const { getToken, isSignedIn } = useAuth();

  const fetchUserData = async () => {
    // 1. Retrieve the active Clerk JWT session token
    const token = await getToken();

    // 2. Attach token to outbound request
    const response = await fetch('/api/client/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    console.log("Protected User Data:", data);
  };

  if (!isSignedIn) return <p>Please sign in</p>;

  return <button onClick={fetchUserData}>Fetch My Details</button>;
}
```

### B. Testing Protected Endpoints via cURL or Postman
1. Open `http://localhost:5173` in your browser and sign in.
2. Open Browser DevTools Console (`F12`) and extract your active session JWT token by running:
   ```javascript
   await window.Clerk.session.getToken()
   ```
3. Copy the output token string and send request with header:
   ```bash
   curl -X GET http://localhost:3000/api/client/me \
     -H "Authorization: Bearer <YOUR_CLERK_JWT_TOKEN>"
   ```