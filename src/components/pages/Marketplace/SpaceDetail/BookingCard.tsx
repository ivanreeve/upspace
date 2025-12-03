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
};

export function BookingCard({ spaceName, onBook }: BookingCardProps) {
  return (
    <Card className="shadow-sm lg:sticky lg:top-28 rounded-md">
      <CardHeader className="pb-0">
        <CardTitle className="text-lg">Book a reservation</CardTitle>
        <CardDescription>Reserve { spaceName } for your next session.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 pt-2 justify-end">
        <p className="text-sm text-muted-foreground">
          Share your details and we will confirm availability with the host.
        </p>
        <Button type="button" className="w-full" onClick={ onBook }>
          <FiCalendar className="mr-2 size-4" aria-hidden="true" />
          Book a reservation
        </Button>
      </CardContent>
    </Card>
  );
}
