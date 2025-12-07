import { FiCalendar } from 'react-icons/fi';

import { Button } from '@/components/ui/button';
import {
Card,
CardContent,
CardDescription,
CardHeader,
CardTitle
} from '@/components/ui/card';

type BookingCardProps = {
  spaceName: string;
  onBook: () => void;
  isDisabled?: boolean;
};

export function BookingCard({
 spaceName, onBook, isDisabled = false, 
}: BookingCardProps) {
  return (
    <Card className="shadow-sm lg:sticky lg:top-28 rounded-md">
      <CardHeader className="pb-0">
        <CardTitle className="text-lg text-[#4a2c0f] dark:text-foreground">Book a reservation</CardTitle>
        <CardDescription className="text-[#654321] -mt-2 dark:text-[#CBCBCB]"> Reserve { spaceName } for your next session.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 pt-2 justify-end">
        <p className="text-sm text-muted-foreground">
          Please share your details, and we’ll reach out to the host to confirm their availability.
        </p>
        <Button
          type="button"
          className="w-full relative overflow-hidden group"
          onClick={ onBook }
          disabled={ isDisabled }
        >
          <span className="absolute inset-0 bg-white/20 scale-0 rounded-full opacity-0 transition-all duration-500 group-hover:scale-150 group-hover:opacity-100" />
          <FiCalendar className="mr-2 size-4 relative z-10" aria-hidden="true" />
          <span className="relative z-10">Book a reservation</span>
        </Button>
      </CardContent>
    </Card>
  );
}
