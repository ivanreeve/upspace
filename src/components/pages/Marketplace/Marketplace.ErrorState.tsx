'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

type MarketplaceErrorStateProps = {
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
};

export function MarketplaceErrorState({
  onRetry,
  isRetrying = false,
  className,
}: MarketplaceErrorStateProps) {
  return (
    <Card className={ cn('w-full max-w-3xl border-none bg-transparent', className) }>
      <CardContent className="flex flex-col items-center gap-6 px-6 py-10 text-center">
        <SystemErrorIllustration className="h-auto w-full max-w-[420px]" />
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-muted-foreground">System error</h2>
          <p className="text-sm text-muted-foreground">
            Something went a little bleep-bloop. We couldn&apos;t process your request.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function MarketplaceErrorStateLight({
  onRetry,
  isRetrying = false,
  className,
}: MarketplaceErrorStateProps) {
  return (
    <Card className={ cn('w-full max-w-3xl border-none bg-transparent', className) }>
      <CardContent className="flex flex-col items-center gap-6 px-6 py-10 text-center">
        <SystemErrorIllustrationLight className="h-auto w-full max-w-[420px]" />
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-muted-foreground">System error</h2>
          <p className="text-sm text-muted-foreground">
            Something went a little bleep-bloop. We couldn&apos;t process your request.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

type SystemErrorIllustrationProps = {
  className?: string;
};

function SystemErrorIllustration({ className, }: SystemErrorIllustrationProps) {
  return (
    <div className={ cn('w-full', className) } aria-hidden="true">
      <svg
        viewBox="0 0 400 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
      >
        <circle cx="200" cy="150" r="120" fill="#262626" />

        <g className="error-robot-body">
          <ellipse cx="200" cy="240" rx="40" ry="6" fill="#000" opacity="0.3" />

          <rect x="150" y="140" width="100" height="80" rx="20" fill="#3c3c3c" />
          <rect x="150" y="140" width="100" height="76" rx="20" fill="#3c3c3c" />

          <rect x="170" y="160" width="60" height="40" rx="4" fill="#161616" />
          <path
            d="M175 180 H190 L195 170 L205 190 L210 180 H225"
            stroke="#007c86"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <rect x="190" y="130" width="20" height="10" fill="#3c3c3c" />

          <rect x="140" y="60" width="120" height="70" rx="16" fill="#3c3c3c" />
          <rect x="140" y="60" width="120" height="66" rx="16" fill="#3c3c3c" />

          <rect x="155" y="75" width="90" height="40" rx="4" fill="#0c0c0c" />

          <path
            d="M170 85 L180 95 M180 85 L170 95"
            stroke="#007c86"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M220 85 L230 95 M230 85 L220 95"
            stroke="#007c86"
            strokeWidth="3"
            strokeLinecap="round"
          />

          <path d="M200 60 V 40" stroke="#3c3c3c" strokeWidth="4" />
          <circle cx="200" cy="35" r="5" fill="#007c86" />

          <path
            d="M150 160 C 130 160, 130 200, 140 210"
            stroke="#3c3c3c"
            strokeWidth="12"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M250 160 C 270 160, 270 190, 260 200"
            stroke="#3c3c3c"
            strokeWidth="12"
            strokeLinecap="round"
            fill="none"
          />
        </g>

      </svg>

      <style jsx>{ `
        @keyframes error-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @keyframes error-spark {
          0% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1.2); }
          100% { opacity: 0; transform: scale(0); }
        }

        .error-robot-body { animation: error-float 4s ease-in-out infinite; }
        .error-gear { animation: error-rotate-gear 10s linear infinite; }
      ` }</style>
    </div>
  );
}

function SystemErrorIllustrationLight({ className, }: SystemErrorIllustrationProps) {
  return (
    <div className={ cn('w-full', className) } aria-hidden="true">
      <svg
        viewBox="0 0 400 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
      >
        <circle cx="200" cy="150" r="120" fill="#f8ead5" />

        <g className="error-robot-body">
          <ellipse cx="200" cy="240" rx="40" ry="6" fill="#000" opacity="0.3" />

          <rect x="150" y="140" width="100" height="80" rx="20" fill="#d1c1a7" />
          <rect x="150" y="140" width="100" height="76" rx="20" fill="#d1c1a7" />

          <rect x="170" y="160" width="60" height="40" rx="4" fill="#161616" />
          <path
            d="M175 180 H190 L195 170 L205 190 L210 180 H225"
            stroke="#007c86"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <rect x="190" y="130" width="20" height="10" fill="#d1c1a7" />

          <rect x="140" y="60" width="120" height="70" rx="16" fill="#d1c1a7" />
          <rect x="140" y="60" width="120" height="66" rx="16" fill="#d1c1a7" />

          <rect x="155" y="75" width="90" height="40" rx="4" fill="#0c0c0c" />

          <path
            d="M170 85 L180 95 M180 85 L170 95"
            stroke="#007c86"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M220 85 L230 95 M230 85 L220 95"
            stroke="#007c86"
            strokeWidth="3"
            strokeLinecap="round"
          />

          <path d="M200 60 V 40" stroke="#d1c1a7" strokeWidth="4" />
          <circle cx="200" cy="35" r="5" fill="#007c86" />

          <path
            d="M150 160 C 130 160, 130 200, 140 210"
            stroke="#d1c1a7"
            strokeWidth="12"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M250 160 C 270 160, 270 190, 260 200"
            stroke="#d1c1a7"
            strokeWidth="12"
            strokeLinecap="round"
            fill="none"
          />
        </g>

      </svg>

      <style jsx>{ `
        @keyframes error-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @keyframes error-spark {
          0% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1.2); }
          100% { opacity: 0; transform: scale(0); }
        }

        .error-robot-body { animation: error-float 4s ease-in-out infinite; }
        .error-gear { animation: error-rotate-gear 10s linear infinite; }
      ` }</style>
    </div>
  );
}
