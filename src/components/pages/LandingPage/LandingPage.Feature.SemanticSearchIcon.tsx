'use client';

import {
useEffect,
useId,
useRef,
useState
} from 'react';

const DOT_ROWS = [6, 16, 26];
const DOT_RADIUS = 3;
const COLUMN_GAP = 24;
const INITIAL_COLUMN_X = 8;
const COLUMN_COUNT = 18;
const VIEWBOX_HEIGHT = 32;
const VIEWBOX_WIDTH = INITIAL_COLUMN_X * 2 + (COLUMN_COUNT - 1) * COLUMN_GAP;
const COLUMN_POSITIONS = Array.from(
  { length: COLUMN_COUNT, },
  (_, index) => INITIAL_COLUMN_X + index * COLUMN_GAP
);

type DotAnimationVariant = {
  delay: number;
  duration: number;
  keyTimes: string;
  values: string;
};

const COLUMN_ANIMATIONS: DotAnimationVariant[] = [
  {
 delay: 0,
duration: 4.4,
keyTimes: '0;0.35;0.65;1',
values: '1;0.2;0.6;1', 
},
  {
 delay: 1.1,
duration: 5.1,
keyTimes: '0;0.25;0.5;0.75;1',
values: '1;0.45;0.15;0.6;1', 
},
  {
 delay: 0.6,
duration: 3.8,
keyTimes: '0;0.4;0.7;1',
values: '1;0.3;0.75;1', 
},
  {
 delay: 1.7,
duration: 4.9,
keyTimes: '0;0.2;0.5;0.8;1',
values: '1;0.35;0.1;0.55;1', 
},
  {
 delay: 0.9,
duration: 5.6,
keyTimes: '0;0.3;0.6;1',
values: '1;0.25;0.65;1', 
},
  {
 delay: 1.3,
duration: 6.2,
keyTimes: '0;0.2;0.45;0.7;1',
values: '1;0.15;0.55;0.3;1', 
}
];

function DottedLine() {
  const gradientId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({
 width: VIEWBOX_WIDTH,
height: VIEWBOX_HEIGHT, 
});

  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    const updateDimensions = () => {
      const {
 width, height, 
} = element.getBoundingClientRect();
      setDimensions({
        width: width || VIEWBOX_WIDTH,
        height: height || VIEWBOX_HEIGHT,
      });
    };

    updateDimensions();

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      const {
 width, height, 
} = entry.contentRect;
      setDimensions({
        width: width || VIEWBOX_WIDTH,
        height: height || VIEWBOX_HEIGHT,
      });
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const scaleX = dimensions.width > 0 ? dimensions.width / VIEWBOX_WIDTH : 1;
  const scaleY = dimensions.height > 0 ? dimensions.height / VIEWBOX_HEIGHT : 1;
  const ellipseRx = DOT_RADIUS / (scaleX || 1);
  const ellipseRy = DOT_RADIUS / (scaleY || 1);

  return (
    <div
      ref={ containerRef }
      className="pointer-events-none relative h-8 w-full flex-1 overflow-hidden rounded-full"
      aria-hidden="true"
    >
      <svg
        className="h-full w-full"
        viewBox={ `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}` }
        preserveAspectRatio="none"
        role="presentation"
      >
        <defs>
          <linearGradient
            id={ gradientId }
            x1="0"
            y1="0"
            x2={ VIEWBOX_WIDTH }
            y2="0"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0" />
            <stop offset="25%" stopColor="#2dd4bf" />
            <stop offset="50%" stopColor="#f97316" />
            <stop offset="75%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
          </linearGradient>
        </defs>

        { COLUMN_POSITIONS.map((x, columnIndex) => {
          const variant = COLUMN_ANIMATIONS[columnIndex % COLUMN_ANIMATIONS.length];

          return DOT_ROWS.map((y, rowIndex) => (
            <ellipse
              key={ `${columnIndex}-${rowIndex}` }
              cx={ x }
              cy={ y }
              rx={ ellipseRx }
              ry={ ellipseRy }
              fill={ `url(#${gradientId})` }
            >
              <animate
                attributeName="opacity"
                values={ variant.values }
                keyTimes={ variant.keyTimes }
                dur={ `${variant.duration}s` }
                begin={ `${variant.delay + rowIndex * 0.33}s` }
                repeatCount="indefinite"
              />
            </ellipse>
          ));
        }) }
      </svg>
    </div>
  );
}

export function SemanticSearchIcon() {
  return (
    <div className="relative flex h-36 w-full items-center justify-center gap-12">
      <DottedLine />
      <div className="relative isolate h-36 w-36 rounded-xl before:absolute before:inset-0 before:-z-20 before:rounded-[inherit] before:bg-[linear-gradient(135deg,#2dd4bf_0%,#f97316_50%,#2dd4bf_100%)] before:content-[''] after:absolute after:inset-[4px] after:-z-10 after:rounded-[inherit] after:bg-muted after:content-['']">
        <div className="absolute inset-4 z-10 flex items-center justify-center rounded-md bg-background">
          <svg
            className="h-16 w-16 drop-shadow-[0_0_18px_rgba(250,250,255,0.6)]"
            viewBox="0 0 120 120"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Animated Gemini spark"
          >
            <defs>
              <linearGradient id="semantic-spark-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="45%" stopColor="#2dd4bf" />
                <stop offset="100%" stopColor="#0f766e" />
              </linearGradient>
              <radialGradient id="semantic-spark-glow" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
              <filter id="semantic-spark-motion-blur" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="0">
                  <animate
                    attributeName="stdDeviation"
                    values="0;0;3;0"
                    keyTimes="0;0.6;0.72;1"
                    dur="1.5s"
                    calcMode="spline"
                    keySplines="0.35 0 0.65 0;0.2 0.8 0.4 1;0.6 0 0.8 0.2"
                    repeatCount="indefinite"
                  />
                </feGaussianBlur>
              </filter>
            </defs>

            <g>
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="0 60 60;40 60 60;360 60 60"
                keyTimes="0;0.68;1"
                dur="1.5s"
                calcMode="spline"
                keySplines="0.55 0 0.85 0.2;0.15 0.85 0.3 1"
                repeatCount="indefinite"
              />
              <path
                d="M60 8C62 32 88 58 112 60C88 62 62 88 60 112C58 88 32 62 8 60C32 58 58 32 60 8Z"
                fill="url(#semantic-spark-gradient)"
                filter="url(#semantic-spark-motion-blur)"
              />
            </g>
          </svg>
        </div>
      </div>
      <DottedLine />
    </div>
  );
}
