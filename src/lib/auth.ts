import { createHmac } from 'crypto';

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

async function fetchFacebookEmail(accessToken: string): Promise<string | null> {
  const params = new URLSearchParams({
    fields: 'id,name,email,picture',
    access_token: accessToken,
  });

  const appSecret = process.env.FACEBOOK_CLIENT_SECRET;
  if (appSecret) {
    const proof = createHmac('sha256', appSecret)
      .update(accessToken)
      .digest('hex');
    params.set('appsecret_proof', proof);
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/me?${params.toString()}`
    );
    const payload = await response.json();
    if (process.env.NODE_ENV === 'development') {
      console.info('Facebook email fetch response', payload);
    }

    if (payload && typeof payload.email === 'string') {
      return payload.email;
    }

    if (
      payload
      && Array.isArray(payload.emails)
      && typeof payload.emails[0]?.value === 'string'
    ) {
      return payload.emails[0].value;
    }

    return null;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Facebook email fetch failed', error);
    }
    return null;
  }
}

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
      authorization: {
 params: {
 scope: 'public_profile,email',
auth_type: 'rerequest', 
}, 
},
      userinfo: { params: { fields: 'id,name,email,picture{url}', }, },
      profile: async (fbProfile, tokens) => {
        let email = fbProfile.email ?? null;

        if (!email && tokens?.access_token) {
          email = await fetchFacebookEmail(tokens.access_token);
        }

        return {
          id: fbProfile.id,
          name: fbProfile.name,
          email,
          image: fbProfile.picture?.data?.url ?? null,
        };
      },
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

      if (
        !token.email
        && account?.provider === 'facebook'
        && typeof account.access_token === 'string'
      ) {
        const emailFromGraph = await fetchFacebookEmail(account.access_token);
        if (emailFromGraph) {
          token.email = emailFromGraph;
        }
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
