import GoogleSignInButton from './GoogleSignInButton';
import EmailPasswordForm from './EmailPasswordForm';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function SignInCard({
  callbackUrl = '/dashboard',
  forgotHref = '/forgot-password',
  className,
}: {
  title?: string; description?: string; callbackUrl?: string; forgotHref?: string; className?: string;
}) {
  return (
    <Card className={ cn('bg-background', className) }>
      <CardContent>
        <GoogleSignInButton callbackUrl={ callbackUrl } />
        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          <span>OR</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <EmailPasswordForm callbackUrl={ callbackUrl } forgotHref={ forgotHref } />
      </CardContent>
    </Card>
  );
}
