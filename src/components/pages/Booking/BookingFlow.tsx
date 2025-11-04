'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { z } from 'zod';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import {
  AvailabilityRecord,
  BookingArea,
  PricingDetails,
  ReviewSummary,
  AvailabilityMap,
  buildRateOptions,
  getAvailabilityWindowsForDate,
  isTimeWithinAvailability,
  normalizeAvailability,
  resolveRatePricing,
  minutesToTimeValue,
  parseTimeInputToMinutes
} from './booking-utils';
import { ReservationStep } from './components/ReservationStep';
import { PaymentStep } from './components/PaymentStep';
import { ConfirmationStep } from './components/ConfirmationStep';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Form } from '@/components/ui/form';


const reservationSchema = z.object({
  areaId: z.string().min(1, 'Choose an area'),
  reservationDate: z.date({ required_error: 'Select a reservation date', }),
  stayHours: z.coerce.number().int().min(1).max(24),
  guests: z.coerce.number().int().min(1, 'At least one guest').max(200),
  arrivalTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM format'),
});

export type ReservationFormValues = z.infer<typeof reservationSchema>;
type BookingStep = 1 | 2 | 3;

type BookingFlowProps = {
  spaceId: string;
  spaceName: string;
  spaceLocation: string;
  areaOptions: BookingArea[];
  availability: AvailabilityRecord[];
  paymentGatewayLabel?: string;
};

type BookingResponse = {
  booking: {
    booking_id: string;
    user_id: string;
    space_id: string;
    area_id: string;
    expires_at: string;
    status_code: string;
    reservation_date: string;
    arrival_time: string | null;
    from: string | null;
    to: string | null;
    guest_count: string;
    booking_type: string;
    created_at: string;
    updated_at: string | null;
    idempotency_key: string;
    total_amount: string;
    payment_method: string | null;
    duration_hours: number;
    pricing: {
      total: string;
      perGuest: string | null;
      label: string | null;
      usesHourlyMultiplier: boolean;
    };
    area: {
      name: string;
      rate: Array<{ rate_id: string; time_unit: string; price: string }>;
    };
    space: {
      name: string;
      city: string;
      region: string;
      country: string;
    };
    user: {
      name: string;
      email: string;
      handle?: string;
    };
  };
  summary: {
    invoiceNumber: string;
    idempotencyKey: string;
    totalAmount: string;
    paymentMethod: string;
    status: string;
    pricingLabel: string | null;
    perGuestAmount: string | null;
  };
};

const DEFAULT_HOUR_OPTIONS = Array.from({ length: 12, }, (_, idx) => {
  const value = idx + 1;
  return {
 value,
label: `${value} ${value === 1 ? 'hour' : 'hours'}`, 
};
});

const STEP_LABELS: Record<BookingStep, string> = {
  1: 'Reservation Details',
  2: 'Payment Method',
  3: 'Confirmation',
};

export function BookingFlow({
  spaceId,
  spaceName,
  spaceLocation,
  areaOptions,
  availability,
  paymentGatewayLabel = 'PayMongo',
}: BookingFlowProps) {
  const [step, setStep] = useState<BookingStep>(1);
  const [reviewData, setReviewData] = useState<ReviewSummary | null>(null);
  const [result, setResult] = useState<BookingResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const availabilityMap: AvailabilityMap = useMemo(
    () => normalizeAvailability(availability ?? []),
    [availability]
  );

  const form = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      areaId: '',
      reservationDate: undefined,
      stayHours: 1,
      guests: 1,
      arrivalTime: '',
    },
  });

  const watchAll = useWatch({
    control: form.control,
    defaultValue: {
      areaId: '',
      reservationDate: undefined,
      stayHours: 1,
      guests: 1,
    },
  }) as Partial<ReservationFormValues>;

  const selectedAreaId = watchAll.areaId ?? '';
  const selectedDate = watchAll.reservationDate;
  const rawStayHours = watchAll.stayHours;
  const rawGuests = watchAll.guests;

  const selectedArea = useMemo(
    () => areaOptions.find((option) => option.id === selectedAreaId) ?? null,
    [areaOptions, selectedAreaId]
  );

  const stayHours = useMemo(() => {
    const candidate =
      rawStayHours ?? form.getValues('stayHours');
    const value =
      typeof candidate === 'string' ? Number(candidate) : candidate;
    return Number.isFinite(value) && value != null ? value : 0;
  }, [rawStayHours, form]);

  const guests = useMemo(() => {
    const candidate =
      rawGuests ?? form.getValues('guests');
    const value =
      typeof candidate === 'string' ? Number(candidate) : candidate;
    if (!Number.isFinite(value) || value == null) return 0;
    const minGuests = Math.max(1, selectedArea?.minCapacity ?? 1);
    const maxGuests =
      selectedArea?.maxCapacity != null
        ? Math.max(minGuests, selectedArea.maxCapacity)
        : null;
    if (maxGuests != null) {
      return Math.min(Math.max(value, minGuests), maxGuests);
    }
    return Math.max(value, minGuests);
  }, [rawGuests, form, selectedArea]);

  const { hourOptions, } = useMemo(
    () => buildRateOptions(selectedArea, DEFAULT_HOUR_OPTIONS),
    [selectedArea]
  );
  const currentPricing: PricingDetails | null = useMemo(
    () => (selectedArea ? resolveRatePricing(selectedArea, stayHours, guests) : null),
    [selectedArea, stayHours, guests]
  );

  const totalEstimate = currentPricing?.total ?? 0;
  const availabilityWindows = useMemo(
    () => getAvailabilityWindowsForDate(selectedDate, availabilityMap),
    [selectedDate, availabilityMap]
  );

  useEffect(() => {
    if (!selectedArea) return;
    if (!hourOptions.length) {
      if (stayHours !== 1) form.setValue('stayHours', 1);
      return;
    }
    const hasMatch = hourOptions.some((option) => option.value === stayHours);
    if (!hasMatch) {
      form.setValue('stayHours', hourOptions[0].value);
    }
  }, [selectedArea, hourOptions, stayHours, form]);

  useEffect(() => {
    const parseGuests = (value: unknown) => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };

    const minGuests = Math.max(1, selectedArea?.minCapacity ?? 1);
    const maxGuests =
      selectedArea?.maxCapacity != null
        ? Math.max(minGuests, selectedArea.maxCapacity)
        : null;

    const current = parseGuests(form.getValues('guests'));
    let next = current ?? minGuests;

    if (!Number.isFinite(next)) {
      next = minGuests;
    }
    if (next < minGuests) {
      next = minGuests;
    }
    if (maxGuests != null && next > maxGuests) {
      next = maxGuests;
    }

    if (current == null || next !== current) {
      form.setValue('guests', next);
    }
  }, [selectedArea, form]);

  useEffect(() => {
    const current = form.getValues('arrivalTime');
    if (!current) return;
    if (!selectedDate || !isTimeWithinAvailability(selectedDate, current, availabilityMap)) {
      form.setValue('arrivalTime', '');
    }
  }, [selectedDate, availabilityMap, form]);

  useEffect(() => {
    if (!selectedDate) return;
    const windows = availabilityWindows;
    if (windows.length === 0) {
      form.setValue('arrivalTime', '');
      return;
    }
    const current = form.getValues('arrivalTime');
    const currentMinutes = parseTimeInputToMinutes(current ?? '');
    const isWithin = currentMinutes != null
      && windows.some((window) => currentMinutes >= window.start && currentMinutes <= window.end);
    if (!isWithin) {
      form.setValue('arrivalTime', minutesToTimeValue(windows[0].start));
    }
  }, [availabilityWindows, selectedDate, form]);

  const handleReservationSubmit = (values: ReservationFormValues) => {
    const area = areaOptions.find((option) => option.id === values.areaId);
    if (!area) {
      toast.error('Selected area is no longer available. Please choose a different one.');
      return;
    }

    const minGuests = Math.max(1, area.minCapacity ?? 1);
    const maxGuests =
      area.maxCapacity != null ? Math.max(minGuests, area.maxCapacity) : null;

    if (values.guests < minGuests || (maxGuests != null && values.guests > maxGuests)) {
      form.setError('guests', {
        type: 'validate',
        message:
          maxGuests != null
            ? `Guests must be between ${minGuests} and ${maxGuests}.`
            : `Guests must be at least ${minGuests}.`,
      });
      toast.error(
        maxGuests != null
          ? `Guest count must be between ${minGuests} and ${maxGuests}.`
          : `Guest count must be at least ${minGuests}.`
      );
      return;
    }

    if (!isTimeWithinAvailability(values.reservationDate, values.arrivalTime, availabilityMap)) {
      form.setError('arrivalTime', {
        type: 'validate',
        message: 'Selected arrival time is outside the available schedule for this day.',
      });
      toast.error('That arrival time falls outside the available schedule.');
      return;
    }

    const pricing = resolveRatePricing(area, values.stayHours, values.guests);

    setReviewData({
      areaId: area.id,
      reservationDate: values.reservationDate,
      stayHours: values.stayHours,
      guests: values.guests,
      arrivalTime: values.arrivalTime,
      totalAmount: pricing.total,
      perGuestRate: pricing.perGuestRate,
      rateLabel: pricing.label,
      usesHourlyMultiplier: pricing.usesHourlyMultiplier,
    });
    setStep(2);
  };

  const handleCreateBooking = async () => {
    if (!reviewData) {
      toast.error('Missing reservation details. Please start over.');
      setStep(1);
      return;
    }

    const area = areaOptions.find((option) => option.id === reviewData.areaId);
    if (!area) {
      toast.error('Selected area is no longer available. Please start over.');
      setStep(1);
      return;
    }

    setIsProcessing(true);
    try {
      const payload = {
        areaId: area.id,
        reservationDate: format(reviewData.reservationDate, 'yyyy-MM-dd'),
        stayHours: reviewData.stayHours,
        guests: reviewData.guests,
        arrivalTime: reviewData.arrivalTime,
        paymentMethod: 'paymongo' as const,
        amount: reviewData.totalAmount,
      };

      const response = await fetch(`/api/marketplace/${spaceId}/booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const message =
          typeof errorBody?.error === 'string'
            ? errorBody.error
            : 'Unable to create booking. Please try again.';
        toast.error(message);
        return;
      }

      const data = (await response.json()) as BookingResponse;
      setResult(data);
      toast.success('Booking created. Awaiting verification!');
      setStep(3);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unexpected error while confirming booking.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const resetFlow = () => {
    form.reset({
      areaId: '',
      reservationDate: undefined,
      stayHours: 1,
      guests: 1,
      arrivalTime: '',
    });
    setReviewData(null);
    setResult(null);
    setStep(1);
  };

  return (
    <section className="space-y-6 rounded-3xl border bg-background/70 p-6 shadow-md">
      <header className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="uppercase tracking-wide">
            Step { step } of 3 · { STEP_LABELS[step] }
          </Badge>
          <Button variant="ghost" size="sm" onClick={ resetFlow }>
            Start over
          </Button>
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            Reserve { spaceName }
          </h2>
          <p className="text-sm text-muted-foreground">
            Pick an area, schedule, and guests. We&apos;ll hold your slot while you
            confirm payment.
          </p>
        </div>
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-1 rounded-full bg-primary transition-all duration-300 ease-out"
            style={ { width: `${(step / 3) * 100}%`, } }
          />
        </div>
      </header>

      { step === 1 && (
        <Card className="border-none bg-transparent shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">Reservation Details</CardTitle>
            <CardDescription>
              Choose the area, date, and precise arrival time that works for you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form { ...form }>
              <ReservationStep
                form={ form }
                areaOptions={ areaOptions }
                selectedArea={ selectedArea }
                totalEstimate={ totalEstimate }
                guestCount={ guests }
                stayHoursValue={ stayHours }
                hourOptions={ hourOptions }
                availabilityMap={ availabilityMap }
                availabilityWindows={ availabilityWindows }
                selectedDate={ selectedDate }
                selectedPricing={ currentPricing }
                onSubmit={ handleReservationSubmit }
                onReset={ () =>
                  form.reset({
                    areaId: '',
                    reservationDate: undefined,
                    stayHours: 1,
                    guests: 1,
                    arrivalTime: '',
                  })
                }
              />
            </Form>
          </CardContent>
        </Card>
      ) }

      { step === 2 && reviewData && selectedArea && (
        <Card className="border-none bg-transparent shadow-none">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Payment Method</CardTitle>
            <CardDescription>
              Confirm your reservation details and proceed with the placeholder payment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <PaymentStep
              spaceName={ spaceName }
              paymentGatewayLabel={ paymentGatewayLabel }
              selectedArea={ selectedArea }
              reviewData={ reviewData }
              onBack={ () => setStep(1) }
              onCancel={ resetFlow }
              onConfirm={ handleCreateBooking }
              isProcessing={ isProcessing }
            />
          </CardContent>
        </Card>
      ) }

      { step === 3 && result && (
        <Card className="border-none bg-transparent shadow-none">
          <CardHeader className="space-y-2">
            <CardTitle className="text-xl">Booking pending verification</CardTitle>
            <CardDescription>
              We sent a confirmation receipt via email. The host will review payment before final approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ConfirmationStep
              result={ result }
              spaceLocation={ spaceLocation }
              review={ reviewData }
              spaceHref={ `/marketplace/${spaceId}` }
            />
          </CardContent>
        </Card>
      ) }
    </section>
  );
}
