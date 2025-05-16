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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.



# MongoDB
MONGODB_URI="mongodb+srv://"
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET="" # Bitte ändern Sie dies in einen sicheren Wert

# Anwendung
NODE_ENV=development

NEXT_PUBLIC_ENABLE_LOCAL_REGISTRATION=true
ENABLE_LOCAL_REGISTRATION=true


# .env
OPENAI_API_KEY=""
OPENAI_CUSTOM_ENDPOINT_URL=""
OPENAI_MODEL_NAME="gpt-4.1-nano"
OPENAI_EMBEDDING_MODEL_NAME="text-embedding-3-large"

QRANT_URL=
# QDRANT_API_KEY wird für eine lokale Docker-Instanz ohne Authentifizierung nicht benötigt
# Falls du lokal einen API-Key verwendest, füge ihn hier hinzu:
#QDRANT_API_KEY=