This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## API Reference (Swagger / OpenAPI 3.0)

The platform exposes a fully documented REST API. The OpenAPI 3.0 source of
truth lives in [`lib/openapi.ts`](lib/openapi.ts) and is served and rendered
at runtime — there is **no build step** and no extra dependency to install.

| URL              | Description                                     |
| ---------------- | ----------------------------------------------- |
| `/api-docs`      | Interactive Swagger UI (try-it-out enabled).    |
| `/api/docs`      | Raw OpenAPI 3.0 JSON (suitable for Postman, codegen, contract tests…). |

### Authentication in Swagger UI

Admin endpoints are protected by the `lakou_admin_session` cookie. To
exercise them from Swagger UI:

1. Open `/api-docs`.
2. Expand **Auth › `POST /api/auth/login`** and *Try it out* with your
   admin password — the response sets the session cookie.
3. Every subsequent *Try it out* call automatically forwards the cookie
   (`withCredentials: true` is set on the Swagger UI client).

Public endpoints (`POST /api/auth/login`, `GET /api/track/{orderNumber}`,
`GET /api/docs`) do not require authentication and are flagged with an
empty `security: []` array in the spec.

### Editing the spec

All endpoint metadata, request/response schemas, parameters, examples and
tag descriptions are centralised in `lib/openapi.ts`. Edit that single
module and refresh `/api-docs` — Swagger UI re-fetches the spec on each
load.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
