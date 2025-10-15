# NVC — Windows / Visual Studio setup (no Docker)

## 1) API (ASP.NET Core Web API)
- Open `NVC.sln` in Visual Studio 2022+.
- Set **api-dotnet** as Startup Project.
- It is configured to run on:
  - HTTP: **http://localhost:5178**
  - HTTPS: **https://localhost:7178**
- Press **F5** to run. Visit `http://localhost:5178/swagger` to verify.

### Quickbase env (Development)
Add these entries to your **User Secrets** or to your environment (Development only):

```
QUICKBASE_REALM = vladimirbuilder.quickbase.com
QUICKBASE_TOKEN = <YOUR_QB_USER_TOKEN>

QB_TABLE_HOUSES   = bvguw9sxx
QB_TABLE_IMAGES   = bvguw9s2h
QB_TABLE_OFFER    = bvguw9s4y
QB_TABLE_QUESTION = bvguw9s74

FID_HOUSE_RID    = 3
FID_HOUSE_TITLE  = 6
FID_HOUSE_PRICE  = 10
FID_HOUSE_DESC   = 7

FID_IMG_PARENT   = 6
FID_IMG_URL      = 10

FID_OFFER_NAME       = 7
FID_OFFER_EMAIL      = 6
FID_OFFER_PHONE      = 9
FID_OFFER_MESSAGE    = 10
FID_OFFER_MODEL_ID   = 11

FID_Q_NAME     = 6
FID_Q_EMAIL    = 7
FID_Q_MESSAGE  = 8
```

## 2) React app (Vite)
- Open **Terminal** (inside VS or PowerShell) in the project folder.
- Install and start Vite dev server:

```
npm i
npm run dev
```

- This runs the SPA at **http://localhost:5173**
- `vite.config.js` is set to **proxy** `/api` and `/swagger` to `http://localhost:5178`

## 3) Verify requests
- Open http://localhost:5178/api/health (should return JSON).
- Open http://localhost:5173, submit **Ask a question** and **Get a quote**.
- The Network tab in DevTools should show **POST /api/question** and **POST /api/offer**.

## Common fixes
- If you get CORS errors, make sure the API is running on 5178 and that `Program.cs` CORS section includes `http://localhost:5173`.
- If no network requests appear on submit, ensure the forms have `onSubmit={submitOffer}` and `onSubmit={submitQuestion}`.
