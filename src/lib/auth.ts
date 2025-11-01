import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

import { verifyPassword } from './password';
import { prisma } from './prisma';

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
  callbacks: {
    async signIn({
 user, account, profile, 
}) {
      try {
        if (account?.provider === 'google') {
          const email = user?.email ?? (typeof profile === 'object' && profile && 'email' in profile ? (profile as any).email : null);
          if (!email) return false;

          const existing = await prisma.user.findUnique({
 where: { email, },
select: { user_id: true, }, 
});
          if (!existing) {
            await prisma.$transaction(async (tx) => {
              const created = await tx.user.create({
                data: {
                  email,
                  handle: email.split('@')[0],
                  avatar: user?.image || null,
                },
              });
              await tx.account.create({
                data: {
                  user_id: created.user_id,
                  provider: 'google',
                  provider_id: account?.providerAccountId ?? user?.id ?? email,
                },
              });
            });
          }
        }
        return true;
      } catch (e) {
        console.error('signIn callback failed', e);
        return false;
      }
    },
    async jwt({
 token, user, profile, account, 
}) {
      if (process.env.NODE_ENV === 'development') {
        console.info('NextAuth jwt callback', {
          hasUser: !!user,
          hasProfile: !!profile,
          hasAccount: !!account,
          tokenEmail: token.email ?? null,
          userEmail: user?.email ?? null,
          profileEmail: profile && typeof profile === 'object' ? 'email' in profile ? profile.email : null : null,
          accountProvider: account?.provider ?? null,
          accountHasAccessToken: !!account?.access_token,
        });
      }
      if (user?.email) token.email = user.email;

      if (
        !token.email
        && profile
        && typeof profile === 'object'
        && 'email' in profile
        && typeof profile.email === 'string'
      ) {
        token.email = profile.email;
      }

      return token;
    },
    async session({
 session, token, 
}) {
      if (process.env.NODE_ENV === 'development') {
        console.info('NextAuth session callback', {
          sessionUserEmail: session.user?.email ?? null,
          tokenEmail: token.email ?? null,
        });
      }
      if (session.user) {
        session.user = {
          ...session.user,
          email: typeof token.email === 'string' ? token.email : session.user.email ?? null,
        };
      }

      return {
        ...session,
        user: session.user ?? null,
      };
    },
  },
  pages: { signIn: '/signin', },
});
