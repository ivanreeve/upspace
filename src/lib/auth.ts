import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// minimal app user shape for credentials flow
type AppUser = { id: string; email: string; name?: string | null };

async function verifyUser(email: string, _password: string): Promise<AppUser | null> {
  // TODO: replace with real lookup + bcrypt compare
  // Temporary stub to keep types happy:
  // return { id: "123", email, name: "Demo User" };
  return null;
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
  pages: { signIn: '/signin', },
});
