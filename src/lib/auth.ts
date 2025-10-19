import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Facebook from 'next-auth/providers/facebook';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

import { verifyPassword } from './password';

import { findMockUserByEmail } from '@/data/mock-users';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// minimal app user shape for credentials flow
type AppUser = { id: string; email: string; name?: string | null };

async function verifyUser(email: string, password: string): Promise<AppUser | null> {
  const record = findMockUserByEmail(email);
  if (!record) return null;

  if (!verifyPassword(password, record.passwordHash)) return null;

  return {
    id: record.id,
    email: record.email,
    name: record.name ?? null,
  };
}

export const {
 handlers, signIn, signOut, auth, 
} = NextAuth({
  session: { strategy: 'jwt', },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Facebook({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    }),
    Credentials({
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await verifyUser(parsed.data.email, parsed.data.password);
        if (!user) return null;

        // NextAuth expects at least { id }
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? null,
        };
      },
    })
  ],
  pages: { signIn: '/signin', },
});
