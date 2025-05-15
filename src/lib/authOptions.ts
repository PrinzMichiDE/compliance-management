import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import AzureADProvider from 'next-auth/providers/azure-ad';
import CredentialsProvider from 'next-auth/providers/credentials';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "E-Mail", type: "email", placeholder: "user@example.com" },
        password: { label: "Passwort", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }
        const db = (await clientPromise).db();
        const usersCollection = db.collection('users');
        const userFromDb = await usersCollection.findOne({ email: credentials.email });

        if (userFromDb && bcrypt.compareSync(credentials.password, userFromDb.password as string)) {
          return {
            id: userFromDb._id.toString(),
            name: userFromDb.name,
            email: userFromDb.email,
            image: userFromDb.image,
            role: userFromDb.role,
          };
        }
        return null;
      }
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          }),
        ]
      : []),
    ...(process.env.AZURE_AD_CLIENT_ID &&
    process.env.AZURE_AD_CLIENT_SECRET &&
    process.env.AZURE_AD_TENANT_ID
      ? [
          AzureADProvider({
            clientId: process.env.AZURE_AD_CLIENT_ID as string,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET as string,
            tenantId: process.env.AZURE_AD_TENANT_ID as string,
          }),
        ]
      : []),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user, account }) {
      const db = (await clientPromise).db();
      const usersCollection = db.collection('users');
      let userRoleFromDb = 'User';
      let userIdFromDb = user.id;

      if (user.email) {
        const existingUser = await usersCollection.findOne({ email: user.email });
        if (existingUser) {
          userRoleFromDb = existingUser.role || 'User'; 
          userIdFromDb = existingUser._id.toString();
        } else {
          if (account?.provider === "google" || account?.provider === "azure-ad") {
            userRoleFromDb = 'User'; 
          }
        }
      }
      user.role = userRoleFromDb;
      user.id = userIdFromDb;
      return true; 
    },
    async jwt({ token, user, account }) {
      if (account && user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
        session.user.roles = token.role ? [token.role] : [];
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    ...(process.env.ENABLE_LOCAL_REGISTRATION === 'true' && { newUser: '/register' }),
  },
  secret: process.env.AUTH_SECRET,
}; 