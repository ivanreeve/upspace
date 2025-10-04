import GoogleSignInButton from './GoogleSignInButton';
import EmailPasswordForm from './EmailPasswordForm';

import {
Card,
CardHeader,
CardTitle,
CardDescription,
CardContent,
CardFooter
} from '@/components/ui/card';

export default function SignInCard({
  callbackUrl = '/dashboard',
  forgotHref = '/forgot-password',
  className,
}: {
  title?: string; description?: string; callbackUrl?: string; forgotHref?: string; className?: string;
}) {
  return (
    <Card className={ className }>
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
