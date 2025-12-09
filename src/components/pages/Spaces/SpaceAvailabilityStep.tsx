'use client';

import { useMemo } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { FiClock } from 'react-icons/fi';

import type { SpaceFormValues } from '@/lib/validations/spaces';
import { WEEKDAY_ORDER } from '@/data/spaces';
import {
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

type SpaceAvailabilityStepProps = {
  form: UseFormReturn<SpaceFormValues>;
};

export function SpaceAvailabilityStep({ form, }: SpaceAvailabilityStepProps) {
  const availability = useWatch<SpaceFormValues, 'availability'>({
    control: form.control,
    name: 'availability',
    defaultValue: form.getValues('availability'),
  });

  const openDayCount = useMemo(() => {
    if (!availability) {
      return 0;
    }

    return WEEKDAY_ORDER.reduce((total, day) => (availability[day]?.is_open ? total + 1 : total), 0);
  }, [availability]);

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="flex items-start gap-2">
          <FiClock className="mt-0.5 size-4 flex-shrink-0" aria-hidden="true" />
          Keep your booking hours aligned with your real-world operations. Guests can only request visits on the days you mark as open.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          { openDayCount > 0
            ? `${openDayCount} day${openDayCount === 1 ? '' : 's'} currently open for bookings.`
            : 'Select at least one day to accept bookings.' }
        </p>
      </div>
      <div className="space-y-4">
        { WEEKDAY_ORDER.map((day) => {
          const isOpen = availability?.[day]?.is_open ?? false;
          const switchId = `availability-${day}-is-open`;
          const openId = `availability-${day}-opens`;
          const closeId = `availability-${day}-closes`;

          return (
            <div key={ day } className="rounded-lg border border-border/70 bg-background/70 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-md font-semibold text-foreground font-sf">{ day }</p>
                </div>
                <FormField
                  control={ form.control }
                  name={ `availability.${day}.is_open` as const }
                  render={ ({ field, }) => (
                    <div className="flex items-center gap-2">
                      <Switch
                        id={ switchId }
                        checked={ isOpen }
                        onCheckedChange={ field.onChange }
                        aria-label={ `Toggle availability for ${day}` }
                      />
                      <label htmlFor={ switchId } className="text-sm text-muted-foreground">
                        { isOpen ? 'Open' : 'Closed' }
                      </label>
                    </div>
                  ) }
                />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <FormField
                  control={ form.control }
                  name={ `availability.${day}.opens_at` as const }
                  render={ ({ field, }) => (
                    <FormItem>
                      <FormLabel htmlFor={ openId }>Opens at</FormLabel>
                      <FormDescription>24-hour time</FormDescription>
                      <Input
                        id={ openId }
                        type="time"
                        step={ 900 }
                        disabled={ !isOpen }
                        value={ field.value ?? '' }
                        onChange={ (event) => field.onChange(event.target.value) }
                        aria-label={ `Opening time on ${day}` }
                      />
                      <FormMessage />
                    </FormItem>
                  ) }
                />
                <FormField
                  control={ form.control }
                  name={ `availability.${day}.closes_at` as const }
                  render={ ({ field, }) => (
                    <FormItem>
                      <FormLabel htmlFor={ closeId }>Closes at</FormLabel>
                      <FormDescription>Must be after opening time</FormDescription>
                      <Input
                        id={ closeId }
                        type="time"
                        step={ 900 }
                        disabled={ !isOpen }
                        value={ field.value ?? '' }
                        onChange={ (event) => field.onChange(event.target.value) }
                        aria-label={ `Closing time on ${day}` }
                      />
                      <FormMessage />
                    </FormItem>
                  ) }
                />
              </div>
            </div>
          );
        }) }
      </div>
    </section>
  );
}
