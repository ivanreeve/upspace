import fs from 'node:fs';
import path from 'node:path';

const ROUTES_ROOT = path.resolve('src/app/api/v1');
const OPENAPI_OUTPUT = path.resolve('public/openapi.json');
const MARKDOWN_OUTPUT = path.resolve('docs/api-reference.md');
const METHOD_ORDER = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const SESSION_SECURITY = [{ SupabaseSession: [], }];

const UUID_SCHEMA = {
 type: 'string',
format: 'uuid', 
};
const DATE_TIME_SCHEMA = {
 type: 'string',
format: 'date-time', 
};
const GENERIC_NULLABLE_OBJECT_SCHEMA = {
  oneOf: [
    {
 type: 'object',
additionalProperties: true, 
},
    { type: 'null', }
  ],
};

const ref = (name) => ({ $ref: `#/components/schemas/${name}`, });

const response = (description, schemaName) => ({
  description,
  content: { 'application/json': { schema: ref(schemaName), }, },
});

const pathParameter = (name, description) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: UUID_SCHEMA,
});

const queryParameter = ({
  name,
  description,
  schema,
  required = false,
}) => ({
  name,
  in: 'query',
  required,
  description,
  schema,
});

const requestBody = (schemaName, description, required = true) => ({
  required,
  description,
  content: { 'application/json': { schema: ref(schemaName), }, },
});

function schemaObject(properties, required = [], description) {
  return {
    type: 'object',
    ...(description ? { description, } : {}),
    properties,
    ...(required.length ? { required, } : {}),
    additionalProperties: false,
  };
}

function schemaArray(items, description) {
  return {
    type: 'array',
    ...(description ? { description, } : {}),
    items,
  };
}

function schemaString(description, extras = {}) {
  return {
    type: 'string',
    ...(description ? { description, } : {}),
    ...extras,
  };
}

function schemaInteger(description, extras = {}) {
  return {
    type: 'integer',
    ...(description ? { description, } : {}),
    ...extras,
  };
}

function schemaNumber(description, extras = {}) {
  return {
    type: 'number',
    ...(description ? { description, } : {}),
    ...extras,
  };
}

function schemaBoolean(description, extras = {}) {
  return {
    type: 'boolean',
    ...(description ? { description, } : {}),
    ...extras,
  };
}

const COMPONENT_SCHEMAS = {
  ErrorResponse: schemaObject(
    {
      error: schemaString('Human-readable error label returned by most route handlers.'),
      message: schemaString('Alternative error message used by some handlers.'),
      errors: {
        type: 'object',
        description: 'Field-level validation details when a Zod payload parse fails.',
        additionalProperties: true,
      },
    },
    [],
    'Standard error envelope used across UpSpace route handlers.'
  ),
  MessageResponse: schemaObject(
    { message: schemaString('User-facing status message.'), },
    ['message'],
    'Simple mutation response for endpoints that only need to acknowledge work.'
  ),
  CursorPagination: schemaObject(
    {
      hasMore: schemaBoolean('Whether another page can be fetched with the returned cursor.'),
      nextCursor: {
        oneOf: [UUID_SCHEMA, { type: 'null', }],
        description: 'Opaque cursor that should be passed back as the next request cursor.',
      },
    },
    ['hasMore'],
    'Cursor pagination contract used by most list endpoints.'
  ),
  SpaceAvailabilityDayInput: schemaObject(
    {
      is_open: schemaBoolean('Whether the space is open on the given weekday.'),
      opens_at: schemaString('Opening time in 24-hour HH:MM format.', {
        pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$',
        example: '08:00',
      }),
      closes_at: schemaString('Closing time in 24-hour HH:MM format.', {
        pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$',
        example: '18:00',
      }),
    },
    ['is_open', 'opens_at', 'closes_at'],
    'Single weekday availability row.'
  ),
  WeeklyAvailabilityInput: schemaObject(
    {
      Monday: ref('SpaceAvailabilityDayInput'),
      Tuesday: ref('SpaceAvailabilityDayInput'),
      Wednesday: ref('SpaceAvailabilityDayInput'),
      Thursday: ref('SpaceAvailabilityDayInput'),
      Friday: ref('SpaceAvailabilityDayInput'),
      Saturday: ref('SpaceAvailabilityDayInput'),
      Sunday: ref('SpaceAvailabilityDayInput'),
    },
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    'Weekly opening-hours grid required when a space is created.'
  ),
  SpaceImageInput: schemaObject(
    {
      path: schemaString('Storage path for the uploaded image asset.', { example: 'space-images/partner-1/main-lobby.jpg', }),
      category: schemaString('Optional semantic label for the image.', { example: 'lobby', }),
      is_primary: schemaBoolean('Whether this image should be used as the hero image.'),
      display_order: schemaInteger('Zero-based sort order.', {
        minimum: 0,
        maximum: 10000,
      }),
    },
    ['path', 'is_primary', 'display_order'],
    'Uploaded public-facing photo metadata.'
  ),
  VerificationDocumentInput: schemaObject(
    {
      path: schemaString('Storage path for the uploaded verification document.'),
      requirement_id: schemaString('Verification checklist item satisfied by the document.', { enum: ['dti_registration', 'tax_registration', 'representative_id'], }),
      slot_id: schemaString('Optional UI slot identifier used when multi-document uploads are grouped.'),
      mime_type: schemaString('Uploaded file MIME type.'),
      file_size_bytes: schemaInteger('Uploaded file size in bytes.', {
        minimum: 1,
        maximum: 52428800,
      }),
    },
    ['path', 'requirement_id', 'mime_type', 'file_size_bytes'],
    'Verification document upload metadata.'
  ),
  CreateSpaceRequest: schemaObject(
    {
      name: schemaString('Public-facing space name.', { maxLength: 200, }),
      description: schemaString('Long-form rich-text description.'),
      unit_number: schemaString('Suite, room, or unit label.'),
      address_subunit: schemaString('Optional building, floor, or landmark detail.'),
      street: schemaString('Street address.'),
      barangay: schemaString('Barangay or district.'),
      city: schemaString('City or municipality.'),
      region: schemaString('Region or province.'),
      postal_code: schemaString('Four-digit postal code.', { pattern: '^[0-9]{4}$', }),
      country_code: schemaString('Two-letter ISO country code.', {
        minLength: 2,
        maxLength: 2,
        example: 'PH',
      }),
      lat: schemaNumber('Latitude coordinate.', {
 minimum: -90,
maximum: 90, 
}),
      long: schemaNumber('Longitude coordinate.', {
 minimum: -180,
maximum: 180, 
}),
      amenities: schemaArray(UUID_SCHEMA, 'Amenity choice identifiers attached to the listing.'),
      availability: ref('WeeklyAvailabilityInput'),
      images: schemaArray(ref('SpaceImageInput'), 'Optional marketing photos and display order.'),
      verification_documents: schemaArray(
        ref('VerificationDocumentInput'),
        'Optional verification documents collected during space creation.'
      ),
    },
    [
      'name',
      'description',
      'street',
      'city',
      'region',
      'postal_code',
      'country_code',
      'lat',
      'long',
      'amenities',
      'availability'
    ],
    'Create a new space listing together with its address, amenities, and availability.'
  ),
  UpdateSpaceRequest: schemaObject(
    {
      name: schemaString('Updated space name.', { maxLength: 200, }),
      unit_number: schemaString('Updated unit number.', { maxLength: 200, }),
      street: schemaString('Updated street value.', { maxLength: 200, }),
      address_subunit: schemaString('Updated address subunit.', { maxLength: 200, }),
      city: schemaString('Updated city.', { maxLength: 200, }),
      region: schemaString('Updated region.', { maxLength: 200, }),
      country: schemaString('Updated country code or label.', { maxLength: 200, }),
      postal_code: schemaString('Updated postal code.', { maxLength: 50, }),
    },
    [],
    'Patch-style payload accepted by the basic `/spaces/{space_id}` PUT handler.'
  ),
  SpaceRecord: schemaObject(
    {
      space_id: schemaString('Space UUID.', { format: 'uuid', }),
      user_id: schemaString('Numeric owner identifier serialized as a string.'),
      name: schemaString('Display name.'),
      description: schemaString('Space description.'),
      unit_number: schemaString('Unit number or suite label.'),
      address_subunit: schemaString('Secondary address detail.'),
      street: schemaString('Street address.'),
      barangay: schemaString('Barangay or district label.'),
      city: schemaString('City or municipality.'),
      region: schemaString('Region or province.'),
      postal_code: schemaString('Postal code.'),
      country_code: schemaString('ISO country code.'),
      lat: schemaNumber('Latitude.'),
      long: schemaNumber('Longitude.'),
      created_at: DATE_TIME_SCHEMA,
      updated_at: DATE_TIME_SCHEMA,
    },
    ['space_id', 'user_id', 'name', 'street', 'city', 'region', 'country_code', 'postal_code'],
    'Representative serialized space object returned by the REST API.'
  ),
  SpaceListResponse: schemaObject(
    {
      data: schemaArray(ref('SpaceRecord'), 'Space records that matched the current query.'),
      pagination: ref('CursorPagination'),
    },
    ['data'],
    'Paginated public space listing.'
  ),
  AmenityChoice: schemaObject(
    {
      id: schemaString('Amenity UUID.', { format: 'uuid', }),
      name: schemaString('Amenity label displayed to users.'),
      identifier: schemaString('Optional machine identifier.'),
      category: schemaString('Amenity grouping used by filters and forms.'),
    },
    ['id', 'name', 'category'],
    'Amenity definition attached to a space.'
  ),
  AmenityAssignmentRequest: schemaObject(
    { name: schemaString('Amenity choice name resolved by the route.', { maxLength: 100, }), },
    ['name'],
    'Attach an amenity choice to a space by amenity name.'
  ),
  AreaRecord: schemaObject(
    {
      id: schemaString('Area UUID.', { format: 'uuid', }),
      name: schemaString('Area label displayed to customers.'),
      space_id: schemaString('Parent space UUID.', { format: 'uuid', }),
      max_capacity: schemaString('Maximum supported guest count, serialized as a string.'),
      automatic_booking_enabled: schemaBoolean('Whether new bookings can auto-confirm.'),
      request_approval_at_capacity: schemaBoolean('Whether capacity edge cases require review.'),
      advance_booking_enabled: schemaBoolean('Whether lead-time requirements are enforced.'),
      advance_booking_value: {
        oneOf: [
          schemaInteger('Lead-time number.'),
          { type: 'null', }
        ],
      },
      advance_booking_unit: {
        oneOf: [
          schemaString('Lead-time unit.', { enum: ['days', 'weeks', 'months'], }),
          { type: 'null', }
        ],
      },
      booking_notes_enabled: schemaBoolean('Whether booking notes are shown to customers.'),
      booking_notes: {
        oneOf: [
          schemaString('Optional booking note rendered in checkout and confirmations.'),
          { type: 'null', }
        ],
      },
      price_rule_id: {
        oneOf: [UUID_SCHEMA, { type: 'null', }],
        description: 'Pricing rule currently attached to the area.',
      },
    },
    ['id', 'name', 'space_id'],
    'Reservable inventory unit within a coworking space.'
  ),
  AreaInput: schemaObject(
    {
      name: schemaString('Area name.', { maxLength: 200, }),
      max_capacity: schemaInteger('Maximum seats or occupants.', { minimum: 1, }),
      automatic_booking_enabled: schemaBoolean('When true, qualifying bookings can auto-confirm.'),
      request_approval_at_capacity: schemaBoolean('When true, edge-of-capacity requests require approval.'),
      advance_booking_enabled: schemaBoolean('When true, lead-time windows are enforced.'),
      advance_booking_value: schemaInteger('Lead-time amount.', { minimum: 1, }),
      advance_booking_unit: schemaString('Lead-time unit.', { enum: ['days', 'weeks', 'months'], }),
      booking_notes_enabled: schemaBoolean('Whether booking notes are shown to customers.'),
      booking_notes: schemaString('Optional customer-facing note.', { maxLength: 2000, }),
      price_rule_id: {
        oneOf: [UUID_SCHEMA, { type: 'null', }],
        description: 'Pricing rule to attach to the area.',
      },
    },
    ['name', 'max_capacity'],
    'Create or update an area inside a partner-managed space.'
  ),
  RateRecord: schemaObject(
    {
      id: schemaString('Rate UUID.', { format: 'uuid', }),
      area_id: schemaString('Parent area UUID.', { format: 'uuid', }),
      label: schemaString('Display label for the rate band.'),
      duration_hours: schemaNumber('Duration in hours represented by the rate.'),
      price_minor: schemaString('Integer minor-unit amount serialized as a string.'),
      currency: schemaString('ISO currency code.', { example: 'PHP', }),
    },
    ['id', 'area_id'],
    'Representative pricing row for a specific area.'
  ),
  AvailabilityRecord: schemaObject(
    {
      id: schemaString('Availability UUID.', { format: 'uuid', }),
      space_id: schemaString('Space UUID.', { format: 'uuid', }),
      day_of_week: schemaInteger('ISO-style weekday index used by the database layer.', {
        minimum: 0,
        maximum: 6,
      }),
      opens_at: schemaString('Opening time in HH:MM format.', { example: '08:00', }),
      closes_at: schemaString('Closing time in HH:MM format.', { example: '18:00', }),
    },
    ['id', 'space_id', 'day_of_week', 'opens_at', 'closes_at'],
    'Persisted availability row for a space.'
  ),
  ReviewTag: schemaObject(
    {
      value: schemaString('Enum value stored in the database.'),
      label: schemaString('UI label shown in review chips and filters.'),
    },
    ['value', 'label'],
    'Review quick-tag option.'
  ),
  ReviewRecord: schemaObject(
    {
      review_id: schemaString('Review UUID.', { format: 'uuid', }),
      rating_star: schemaInteger('Star rating.', {
 minimum: 1,
maximum: 5, 
}),
      description: schemaString('Review body.'),
      created_at: DATE_TIME_SCHEMA,
      reviewer_name: schemaString('Resolved reviewer display name.'),
      reviewer_avatar_url: {
        oneOf: [
          schemaString('Resolved reviewer avatar URL.', { format: 'uri', }),
          { type: 'null', }
        ],
      },
      comments: schemaArray(schemaString('Quick-tag enum value.'), 'Selected review quick tags.'),
    },
    ['review_id', 'rating_star', 'description', 'created_at', 'reviewer_name'],
    'Single customer review item.'
  ),
  ReviewListResponse: schemaObject(
    {
      data: schemaObject(
        {
          summary: schemaObject(
            {
              average_rating: schemaNumber('Average rating across all reviews.', {
 minimum: 0,
maximum: 5, 
}),
              total_reviews: schemaInteger('Total number of reviews.'),
              breakdown: schemaArray(
                schemaObject(
                  {
                    rating: schemaInteger('Star bucket.', {
 minimum: 1,
maximum: 5, 
}),
                    count: schemaInteger('Number of reviews in this bucket.', { minimum: 0, }),
                  },
                  ['rating', 'count']
                ),
                'Rating histogram from five stars down to one star.'
              ),
            },
            ['average_rating', 'total_reviews', 'breakdown']
          ),
          reviews: schemaArray(ref('ReviewRecord'), 'Review page results.'),
          viewer_reviewed: schemaBoolean('Whether the authenticated viewer already reviewed this space.'),
          pagination: ref('CursorPagination'),
        },
        ['summary', 'reviews', 'viewer_reviewed', 'pagination']
      ),
    },
    ['data'],
    'Review list with aggregate statistics and cursor pagination.'
  ),
  CreateReviewRequest: schemaObject(
    {
      rating_star: schemaInteger('Star rating from one to five.', {
        minimum: 1,
        maximum: 5,
      }),
      description: schemaString('Review body.', {
        minLength: 10,
        maxLength: 2000,
      }),
      comments: schemaArray(
        schemaString('Quick-tag enum value returned by `GET /api/v1/reviews/tags`.'),
        'Optional review quick tags.'
      ),
    },
    ['rating_star', 'description'],
    'Create a customer review after a completed booking.'
  ),
  BookingRecord: schemaObject(
    {
      id: schemaString('Booking UUID.', { format: 'uuid', }),
      spaceId: schemaString('Space UUID.', { format: 'uuid', }),
      spaceName: schemaString('Cached space name.'),
      areaId: schemaString('Area UUID.', { format: 'uuid', }),
      areaName: schemaString('Cached area name.'),
      bookingHours: schemaNumber('Requested booking duration in hours.'),
      startAt: DATE_TIME_SCHEMA,
      guestCount: {
        oneOf: [
          schemaInteger('Guest count.'),
          { type: 'null', }
        ],
      },
      price: {
        oneOf: [
          schemaNumber('Booking total in major currency units.'),
          { type: 'null', }
        ],
      },
      status: schemaString('Current booking lifecycle status.', { enum: ['confirmed', 'pending', 'cancelled', 'rejected', 'expired', 'checkedin', 'checkedout', 'completed', 'noshow'], }),
      createdAt: DATE_TIME_SCHEMA,
      customerAuthId: schemaString('Supabase auth UUID of the customer.'),
      partnerAuthId: {
        oneOf: [
          schemaString('Supabase auth UUID of the partner.'),
          { type: 'null', }
        ],
      },
      areaMaxCapacity: {
        oneOf: [
          schemaInteger('Maximum supported capacity for the area.'),
          { type: 'null', }
        ],
      },
      customerHandle: { oneOf: [schemaString('Customer handle.'), { type: 'null', }], },
      customerName: { oneOf: [schemaString('Resolved customer display name.'), { type: 'null', }], },
    },
    ['id', 'spaceId', 'spaceName', 'areaId', 'areaName', 'bookingHours', 'startAt', 'status', 'createdAt'],
    'Normalized booking record returned by list endpoints.'
  ),
  BookingListResponse: schemaObject(
    {
      data: schemaArray(ref('BookingRecord'), 'Booking results.'),
      pagination: ref('CursorPagination'),
    },
    ['data', 'pagination'],
    'Paginated booking list.'
  ),
  CreateBookingRequest: schemaObject(
    {
      spaceId: schemaString('Target space UUID.', { format: 'uuid', }),
      areaId: schemaString('Target area UUID.', { format: 'uuid', }),
      bookingHours: schemaInteger('Requested duration in hours.', {
        minimum: 1,
        maximum: 24,
      }),
      startAt: schemaString('Optional ISO timestamp for the booking start.', { format: 'date-time', }),
      guestCount: schemaInteger('Guest count.', {
        minimum: 1,
        maximum: 999,
      }),
      variableOverrides: {
        type: 'object',
        description: 'Optional pricing-rule variables supplied by the checkout UI.',
        additionalProperties: {
          oneOf: [
            { type: 'string', },
            { type: 'number', }
          ],
        },
      },
    },
    ['spaceId', 'areaId', 'bookingHours'],
    'Create a booking for a specific area and start time.'
  ),
  BulkBookingStatusUpdateRequest: schemaObject(
    {
      ids: schemaArray(UUID_SCHEMA, 'Booking UUIDs to update in bulk.'),
      status: schemaString('New booking status.', { enum: ['confirmed', 'pending', 'cancelled', 'rejected', 'expired', 'checkedin', 'checkedout', 'completed', 'noshow'], }),
      cancellationReason: schemaString('Required for cancellation workflows.', {
        minLength: 5,
        maxLength: 500,
      }),
    },
    ['ids', 'status'],
    'Bulk status mutation used by partner and admin booking dashboards.'
  ),
  BookingRescheduleRequest: schemaObject(
    {
      startAt: schemaString('New booking start timestamp.', { format: 'date-time', }),
      bookingHours: schemaInteger('Updated duration in hours.', {
        minimum: 1,
        maximum: 24,
      }),
      guestCount: schemaInteger('Updated guest count.', {
        minimum: 1,
        maximum: 999,
      }),
    },
    ['startAt'],
    'Reschedule an existing booking.'
  ),
  CancelBookingRequest: schemaObject(
    {
      cancellationReason: schemaString('Reason shown to counterparties and audit tooling.', {
        minLength: 5,
        maxLength: 500,
      }),
    },
    ['cancellationReason'],
    'Customer or operator cancellation payload.'
  ),
  BookmarkMutationRequest: schemaObject(
    { space_id: schemaString('Space UUID to bookmark or unbookmark.', { format: 'uuid', }), },
    ['space_id'],
    'Bookmark mutation payload.'
  ),
  NotificationRecord: schemaObject(
    {
      id: schemaString('Notification UUID.', { format: 'uuid', }),
      title: schemaString('Notification title.'),
      body: schemaString('Notification body text.'),
      href: schemaString('Internal navigation target.'),
      type: schemaString('Notification type.', { enum: ['booking_confirmed', 'booking_received', 'message', 'system'], }),
      createdAt: DATE_TIME_SCHEMA,
      readAt: { oneOf: [DATE_TIME_SCHEMA, { type: 'null', }], },
    },
    ['id', 'title', 'body', 'href', 'type', 'createdAt'],
    'Serialized notification entry.'
  ),
  NotificationListResponse: schemaObject(
    {
      data: schemaArray(ref('NotificationRecord'), 'Notification results.'),
      pagination: ref('CursorPagination'),
    },
    ['data', 'pagination'],
    'Notification page response.'
  ),
  NotificationUpdateRequest: schemaObject(
    {
      notificationId: schemaString('Notification UUID.', { format: 'uuid', }),
      read: schemaBoolean('Whether the notification should be marked as read.', { default: true, }),
    },
    ['notificationId'],
    'Single-notification read/unread mutation payload.'
  ),
  NotificationDeleteRequest: schemaObject(
    { notificationId: schemaString('Notification UUID.', { format: 'uuid', }), },
    ['notificationId'],
    'Delete a single notification.'
  ),
  ComplaintRecord: schemaObject(
    {
      id: schemaString('Complaint UUID.', { format: 'uuid', }),
      booking_id: schemaString('Related booking UUID.', { format: 'uuid', }),
      category: schemaString('Complaint category.'),
      description: schemaString('Complaint narrative.'),
      status: schemaString('Complaint lifecycle state.'),
      created_at: DATE_TIME_SCHEMA,
      updated_at: DATE_TIME_SCHEMA,
      escalation_note: { oneOf: [schemaString('Partner escalation note.'), { type: 'null', }], },
      resolution_note: { oneOf: [schemaString('Resolution or dismissal note.'), { type: 'null', }], },
    },
    ['id', 'booking_id', 'category', 'description', 'status', 'created_at', 'updated_at'],
    'Complaint record used by customer, partner, and admin dashboards.'
  ),
  ComplaintListResponse: schemaObject(
    {
      data: schemaArray(ref('ComplaintRecord'), 'Complaint results.'),
      pagination: ref('CursorPagination'),
    },
    ['data', 'pagination'],
    'Paginated complaint list.'
  ),
  CreateComplaintRequest: schemaObject(
    {
      booking_id: schemaString('Booking UUID.', { format: 'uuid', }),
      category: schemaString('Complaint category.'),
      description: schemaString('Complaint description.', {
        minLength: 10,
        maxLength: 2000,
      }),
    },
    ['booking_id', 'category', 'description'],
    'Create a booking-scoped complaint.'
  ),
  PartnerComplaintActionRequest: schemaObject(
    {
      action: schemaString('Partner action.', { enum: ['resolve', 'escalate'], }),
      note: schemaString('Required when escalating a complaint.', { maxLength: 1000, }),
    },
    ['action'],
    'Partner-side complaint action payload.'
  ),
  AdminComplaintActionRequest: schemaObject(
    {
      action: schemaString('Admin action.', { enum: ['resolve', 'dismiss'], }),
      note: schemaString('Required when dismissing a complaint.', { maxLength: 1000, }),
    },
    ['action'],
    'Admin complaint resolution payload.'
  ),
  ChatMessageRequest: schemaObject(
    {
      room_id: {
        oneOf: [UUID_SCHEMA, { type: 'null', }],
        description: 'Existing room UUID. Omit to let the server create or resolve a room from `space_id`.',
      },
      space_id: {
        oneOf: [UUID_SCHEMA, { type: 'null', }],
        description: 'Space UUID used when starting a new conversation.',
      },
      content: schemaString('Chat message content.', {
        minLength: 1,
        maxLength: 1500,
      }),
    },
    ['content'],
    'Send a chat message, optionally creating a room on first contact.'
  ),
  ChatMessageRecord: schemaObject(
    {
      id: schemaString('Message UUID.', { format: 'uuid', }),
      room_id: schemaString('Room UUID.', { format: 'uuid', }),
      sender_role: schemaString('Sender role in the conversation.'),
      content: schemaString('Message body.'),
      created_at: DATE_TIME_SCHEMA,
    },
    ['id', 'room_id', 'sender_role', 'content', 'created_at'],
    'Representative chat message.'
  ),
  ChatReportRequest: schemaObject(
    {
      room_id: schemaString('Room UUID.', { format: 'uuid', }),
      reported_user_id: schemaString('Numeric user identifier serialized as a string.'),
      reason: schemaString('Moderation reason selected in the UI.'),
      details: schemaString('Optional free-form context provided by the reporter.', { maxLength: 1000, }),
    },
    ['room_id', 'reported_user_id', 'reason'],
    'Chat moderation report payload.'
  ),
  WalletRecord: schemaObject(
    {
      id: schemaString('Wallet UUID.', { format: 'uuid', }),
      balanceMinor: schemaString('Current available balance in minor units.'),
      currency: schemaString('Wallet currency.', { example: 'PHP', }),
      createdAt: DATE_TIME_SCHEMA,
      updatedAt: DATE_TIME_SCHEMA,
    },
    ['id', 'balanceMinor', 'currency', 'createdAt', 'updatedAt'],
    'Partner wallet summary.'
  ),
  WalletTransactionRecord: schemaObject(
    {
      id: schemaString('Transaction UUID.', { format: 'uuid', }),
      walletId: schemaString('Wallet UUID.', { format: 'uuid', }),
      type: schemaString('Transaction type.', { enum: ['cash_in', 'charge', 'refund', 'payout'], }),
      status: schemaString('Settlement state.', { enum: ['pending', 'succeeded', 'failed'], }),
      amountMinor: schemaString('Gross amount in minor units.'),
      netAmountMinor: { oneOf: [schemaString('Net settled amount in minor units.'), { type: 'null', }], },
      currency: schemaString('ISO currency code.', { example: 'PHP', }),
      description: schemaString('Ledger description.'),
      bookingId: { oneOf: [UUID_SCHEMA, { type: 'null', }], },
      processedAt: { oneOf: [DATE_TIME_SCHEMA, { type: 'null', }], },
      externalReference: { oneOf: [schemaString('Provider-side reference identifier.'), { type: 'null', }], },
      metadata: GENERIC_NULLABLE_OBJECT_SCHEMA,
      createdAt: DATE_TIME_SCHEMA,
    },
    ['id', 'walletId', 'type', 'status', 'amountMinor', 'currency', 'description', 'createdAt'],
    'Wallet ledger line item.'
  ),
  WalletDashboardResponse: schemaObject(
    {
      wallet: ref('WalletRecord'),
      providerAccount: GENERIC_NULLABLE_OBJECT_SCHEMA,
      transactions: schemaArray(ref('WalletTransactionRecord'), 'Wallet transactions for the current page.'),
      pagination: ref('CursorPagination'),
      stats: schemaObject(
        {
          totalEarnedMinor: schemaString('Total charges credited to the wallet.'),
          totalRefundedMinor: schemaString('Total refunds debited from the wallet.'),
          pendingPayoutMinor: schemaString('Total pending payout amount.'),
          totalPaidOutMinor: schemaString('Total completed payouts.'),
          transactionCount: schemaInteger('Number of transactions matching the current filters.'),
        },
        ['totalEarnedMinor', 'totalRefundedMinor', 'pendingPayoutMinor', 'totalPaidOutMinor', 'transactionCount']
      ),
    },
    ['wallet', 'providerAccount', 'transactions', 'pagination', 'stats'],
    'Wallet dashboard response used by the partner wallet page.'
  ),
  WalletPayoutRequest: schemaObject(
    {
      amountMinor: schemaInteger('Requested payout amount in minor units.', { minimum: 1, }),
      channelCode: schemaString('Xendit payout channel code.'),
      destination: {
        type: 'object',
        description: 'Channel-specific payout destination fields.',
        additionalProperties: true,
      },
      description: schemaString('Optional payout note.', { maxLength: 500, }),
    },
    ['amountMinor', 'channelCode', 'destination'],
    'Create a partner payout request.'
  ),
  WalletRefundRequest: schemaObject(
    {
      bookingId: schemaString('Booking UUID to refund.', { format: 'uuid', }),
      amountMinor: schemaInteger('Refund amount in minor units.', { minimum: 1, }),
      reason: schemaString('Customer-visible refund reason.', { maxLength: 500, }),
    },
    ['bookingId', 'amountMinor'],
    'Create a wallet-backed refund for an existing booking.'
  ),
  AuthEmailRequest: schemaObject(
    { email: schemaString('Email address.', { format: 'email', }), },
    ['email'],
    'Single-email request body used by sign-up availability and OTP routes.'
  ),
  SignupRequest: schemaObject(
    {
      email: schemaString('Account email.', { format: 'email', }),
      password: schemaString('Password matching the current policy.', { minLength: 8, }),
      handle: schemaString('Unique public handle.', {
        minLength: 1,
        maxLength: 64,
      }),
      otp: schemaString('Six-digit email verification code.', { pattern: '^[0-9]{6}$', }),
    },
    ['email', 'password', 'handle', 'otp'],
    'Create a customer account after email ownership has been verified.'
  ),
  AuthProfilePatchRequest: schemaObject(
    {
      first_name: schemaString('Updated first name.', { maxLength: 100, }),
      last_name: schemaString('Updated last name.', { maxLength: 100, }),
      handle: schemaString('Updated public handle.', { maxLength: 64, }),
      avatar: schemaString('Avatar URL or storage path.'),
      phone: schemaString('Optional contact phone number.', { maxLength: 50, }),
      bio: schemaString('Optional biography.', { maxLength: 1000, }),
    },
    [],
    'Update the current authenticated user profile.'
  ),
  AiAssistantRequest: schemaObject(
    {
      query: schemaString('Single-turn customer prompt.', {
        minLength: 1,
        maxLength: 2000,
      }),
      messages: schemaArray(
        schemaObject(
          {
            role: schemaString('Conversation role.', { enum: ['user', 'assistant'], }),
            content: schemaString('Conversation content.'),
          },
          ['role', 'content']
        ),
        'Conversation history used to continue a multi-turn assistant session.'
      ),
      location: schemaObject(
        {
          lat: schemaNumber('Latitude.', {
 minimum: -90,
maximum: 90, 
}),
          long: schemaNumber('Longitude.', {
 minimum: -180,
maximum: 180, 
}),
        },
        ['lat', 'long']
      ),
      conversation_id: {
        oneOf: [UUID_SCHEMA, { type: 'null', }],
        description: 'Existing conversation UUID for persistence and continuation.',
      },
    },
    [],
    'AI assistant request body used by the marketplace conversational search experience.'
  ),
  AiAssistantResponse: schemaObject(
    {
      message: schemaString('Assistant response text.'),
      conversation_id: { oneOf: [UUID_SCHEMA, { type: 'null', }], },
      tool_calls: schemaArray(
        {
          type: 'object',
          additionalProperties: true,
        },
        'Normalized tool invocations emitted during the assistant turn.'
      ),
      metadata: {
        type: 'object',
        additionalProperties: true,
      },
    },
    ['message'],
    'Representative AI assistant response. The exact shape may expand as the toolchain evolves.'
  ),
  AiConversationRecord: schemaObject(
    {
      id: schemaString('Conversation UUID.', { format: 'uuid', }),
      title: { oneOf: [schemaString('Conversation title.'), { type: 'null', }], },
      created_at: DATE_TIME_SCHEMA,
      updated_at: DATE_TIME_SCHEMA,
    },
    ['id', 'created_at', 'updated_at'],
    'Persisted AI conversation record.'
  ),
  AiConversationCreateRequest: schemaObject(
    { title: schemaString('Optional conversation title.', { maxLength: 200, }), },
    [],
    'Create a persisted AI conversation shell.'
  ),
  AiConversationUpdateRequest: schemaObject(
    { title: schemaString('Updated conversation title.', { maxLength: 200, }), },
    [],
    'Rename an existing AI conversation.'
  ),
  PriceRuleVariable: schemaObject(
    {
      key: schemaString('Variable identifier used in formulas.'),
      label: schemaString('Human-friendly label.'),
      type: schemaString('Variable data type.', { enum: ['text', 'number', 'date', 'time'], }),
      initialValue: schemaString('Optional initial value supplied by the editor.'),
      userInput: schemaBoolean('Whether the editor expects user input for the variable.'),
      displayName: schemaString('Optional alternate display name.'),
    },
    ['key', 'label', 'type'],
    'Variable declaration used by the pricing-rule editor.'
  ),
  PriceRuleOperand: {
    oneOf: [
      schemaObject(
        {
          kind: {
            type: 'string',
            const: 'variable',
          },
          key: schemaString('Variable key.'),
        },
        ['kind', 'key']
      ),
      schemaObject(
        {
          kind: {
            type: 'string',
            const: 'literal',
          },
          value: schemaString('Literal value.'),
          valueType: schemaString('Literal type.', { enum: ['text', 'number', 'datetime', 'date', 'time'], }),
        },
        ['kind', 'value', 'valueType']
      )
    ],
    description: 'Operand used in a pricing-rule comparison expression.',
  },
  PriceRuleCondition: schemaObject(
    {
      id: schemaString('Condition UUID.', { format: 'uuid', }),
      connector: schemaString('Boolean connector joining the previous condition.', { enum: ['and', 'or'], }),
      negated: schemaBoolean('Whether the condition result is negated before evaluation.'),
      comparator: schemaString('Comparison operator.', { enum: ['<', '<=', '>', '>=', '=', '!='], }),
      left: ref('PriceRuleOperand'),
      right: ref('PriceRuleOperand'),
    },
    ['id', 'comparator', 'left', 'right'],
    'Single pricing-rule condition.'
  ),
  PriceRuleDefinition: schemaObject(
    {
      variables: schemaArray(ref('PriceRuleVariable'), 'Declared variables.'),
      conditions: schemaArray(ref('PriceRuleCondition'), 'Condition rows.'),
      formula: schemaString('Formula expression applied after conditions are evaluated.'),
    },
    ['variables', 'conditions', 'formula'],
    'Declarative pricing-rule definition.'
  ),
  PriceRuleRequest: schemaObject(
    {
      name: schemaString('Pricing-rule name.'),
      description: schemaString('Optional description.', { maxLength: 500, }),
      definition: ref('PriceRuleDefinition'),
    },
    ['name', 'definition'],
    'Create or update a pricing rule.'
  ),
  PriceRuleRecord: schemaObject(
    {
      id: schemaString('Pricing-rule UUID.', { format: 'uuid', }),
      name: schemaString('Rule name.'),
      description: { oneOf: [schemaString('Optional description.'), { type: 'null', }], },
      definition: ref('PriceRuleDefinition'),
      is_active: schemaBoolean('Whether the rule is enabled.'),
      linked_area_count: schemaInteger('Number of areas currently using the rule.'),
      created_at: DATE_TIME_SCHEMA,
      updated_at: { oneOf: [DATE_TIME_SCHEMA, { type: 'null', }], },
    },
    ['id', 'name', 'definition', 'is_active', 'linked_area_count', 'created_at'],
    'Serialized pricing rule.'
  ),
  PriceRuleEvaluationRequest: schemaObject(
    {
      definition: ref('PriceRuleDefinition'),
      bookingHours: schemaNumber('Booking duration to simulate.', {
        minimum: 0.5,
        maximum: 8760,
      }),
      guestCount: schemaInteger('Optional guest count override.', {
        minimum: 1,
        maximum: 999,
      }),
      startAt: schemaString('Optional evaluation timestamp.', { format: 'date-time', }),
      variableOverrides: {
        type: 'object',
        description: 'Additional variable overrides passed into the evaluator.',
        additionalProperties: { oneOf: [{ type: 'string', }, { type: 'number', }], },
      },
    },
    ['definition', 'bookingHours'],
    'Preview a pricing rule without saving it.'
  ),
  VerificationActionRequest: schemaObject(
    {
      action: schemaString('Verification action.', { enum: ['approve', 'reject'], }),
      rejected_reason: schemaString('Required when rejecting.', { maxLength: 1000, }),
      valid_until: {
        oneOf: [
          schemaString('Optional ISO timestamp for approval expiry.', { format: 'date-time', }),
          { type: 'null', }
        ],
      },
    },
    ['action'],
    'Admin verification review payload.'
  ),
  SpaceVisibilityActionRequest: schemaObject(
    {
      action: schemaString('Visibility action.', { enum: ['hide', 'show'], }),
      reason: schemaString('Optional moderator note.', { maxLength: 500, }),
    },
    ['action'],
    'Admin space visibility mutation payload.'
  ),
  AdminPayoutRequestAction: schemaObject(
    {
      action: schemaString('Administrative payout decision.', { enum: ['complete', 'reject'], }),
      resolution_note: schemaString('Required when rejecting.', { maxLength: 1000, }),
    },
    ['action'],
    'Resolve a partner payout request.'
  ),
  GenericActionRequest: schemaObject(
    {
      action: schemaString('Action keyword selected by the operator.'),
      note: schemaString('Optional note or moderator reason.', { maxLength: 1000, }),
      reason: schemaString('Optional reason string.', { maxLength: 1000, }),
    },
    ['action'],
    'Broad action payload used by several mutation endpoints.'
  ),
  AdminDashboardResponse: schemaObject(
    {
      data: {
        type: 'object',
        description: 'Composite dashboard payload including metrics, recent records, and audit log slices.',
        additionalProperties: true,
      },
    },
    ['data'],
    'Admin dashboard aggregate response.'
  ),
  ProviderAccountStatusResponse: {
    type: 'object',
    description: 'Normalized partner payout-account snapshot returned by the financial provider-account status route.',
    additionalProperties: true,
  },
  AccountExportResponse: {
    type: 'object',
    description: 'Account export payload containing user profile, bookings, wallet, and related records.',
    additionalProperties: true,
  },
  GenericDataResponse: schemaObject(
    {
      data: {
        type: 'object',
        additionalProperties: true,
      },
    },
    ['data'],
    'Fallback success envelope for detail routes that return an object.'
  ),
  GenericListResponse: schemaObject(
    {
      data: schemaArray(
        {
          type: 'object',
          additionalProperties: true,
        },
        'Fallback list payload.'
      ),
      pagination: ref('CursorPagination'),
    },
    ['data'],
    'Fallback list envelope used when a more specific schema is not declared.'
  ),
};

const TAGS = [
  {
    name: 'Account',
    description: 'Data export and account-adjacent utility endpoints.',
  },
  {
    name: 'Admin',
    description: 'Administration dashboards, moderation queues, payout operations, and verification review flows.',
  },
  {
    name: 'AI',
    description: 'Conversational assistant endpoints and persisted AI conversation state.',
  },
  {
    name: 'Amenities',
    description: 'Static amenity and review-tag lookup endpoints used by forms and filters.',
  },
  {
    name: 'Auth',
    description: 'Profile sync, sign-up, deactivation, reactivation, and account removal flows.',
  },
  {
    name: 'Bookings',
    description: 'Customer, partner, and admin booking operations including creation, updates, cancellation, and receipts.',
  },
  {
    name: 'Bookmarks',
    description: 'Customer bookmark mutations.',
  },
  {
    name: 'Chat',
    description: 'Marketplace chat rooms, message history, and moderation reporting.',
  },
  {
    name: 'Complaints',
    description: 'Customer complaints and the partner/admin workflows used to resolve them.',
  },
  {
    name: 'Financial',
    description: 'Checkout creation plus provider-backed payout-account setup and synchronization.',
  },
  {
    name: 'Notifications',
    description: 'In-app notification listing and read/delete mutations.',
  },
  {
    name: 'Partner',
    description: 'Partner dashboard, inventory, verification, and custom pricing-rule management endpoints.',
  },
  {
    name: 'Public Spaces',
    description: 'Public marketplace listing, detail, availability, reviews, and inventory discovery endpoints.',
  },
  {
    name: 'Transactions',
    description: 'Customer-facing transaction history endpoints.',
  },
  {
    name: 'Wallet',
    description: 'Partner wallet balances, payouts, refunds, and transaction history.',
  }
];

const PARAMETER_DESCRIPTIONS = {
  space_id: 'Space UUID.',
  area_id: 'Area UUID.',
  rate_id: 'Rate UUID.',
  availability_id: 'Availability row UUID.',
  booking_id: 'Booking UUID.',
  notification_id: 'Notification UUID.',
  complaint_id: 'Complaint UUID.',
  report_id: 'Chat report UUID.',
  request_id: 'Request UUID.',
  verification_id: 'Verification UUID.',
  user_id: 'Numeric user identifier serialized as a string.',
  price_rule_id: 'Pricing rule UUID.',
  id: 'Resource UUID.',
};

const FAMILY_DOCS = [
  {
    pattern: /^\/api\/v1\/account\/export$/,
    tag: 'Account',
    methods: {
      GET: {
        access: 'Authenticated user',
        summary: 'Export the current account data',
        description:
          'Returns an account export bundle for the signed-in user, including the profile and related marketplace records.',
        responseSchema: 'AccountExportResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/spaces$/,
    tag: 'Public Spaces',
    methods: {
      GET: {
        access: 'Public',
        summary: 'List public spaces',
        description:
          'Returns the public marketplace catalog with cursor pagination, optional text search, geospatial filters, and cached starting-price metadata.',
        parameters: [
          queryParameter({
            name: 'limit',
            description: 'Maximum number of spaces to return.',
            schema: {
 type: 'integer',
minimum: 1,
maximum: 100,
default: 20, 
},
          }),
          queryParameter({
            name: 'cursor',
            description: 'Cursor from the previous result page.',
            schema: UUID_SCHEMA,
          }),
          queryParameter({
            name: 'search',
            description: 'Fuzzy text query matched against space names and addresses.',
            schema: { type: 'string', },
          }),
          queryParameter({
            name: 'lat',
            description: 'Latitude for distance-aware marketplace ranking.',
            schema: {
 type: 'number',
minimum: -90,
maximum: 90, 
},
          }),
          queryParameter({
            name: 'long',
            description: 'Longitude for distance-aware marketplace ranking.',
            schema: {
 type: 'number',
minimum: -180,
maximum: 180, 
},
          }),
          queryParameter({
            name: 'radius',
            description: 'Optional search radius in meters.',
            schema: {
 type: 'number',
minimum: 0, 
},
          }),
          queryParameter({
            name: 'city',
            description: 'Optional city filter.',
            schema: { type: 'string', },
          }),
          queryParameter({
            name: 'region',
            description: 'Optional region or province filter.',
            schema: { type: 'string', },
          })
        ],
        responseSchema: 'SpaceListResponse',
      },
      POST: {
        access: 'Authenticated user',
        summary: 'Create a space',
        description:
          'Creates a new space listing, stores its address and map point, attaches amenity choices, and optionally persists uploaded marketing images and verification documents.',
        requestBody: requestBody(
          'CreateSpaceRequest',
          'Space creation payload including weekly availability and amenity identifiers.'
        ),
        responseSchema: 'GenericDataResponse',
        successStatus: 201,
      },
    },
  },
  {
    pattern: /^\/api\/v1\/spaces\/suggest$/,
    tag: 'Public Spaces',
    methods: {
      GET: {
        access: 'Public',
        summary: 'Suggest search terms',
        description:
          'Returns lightweight marketplace suggestions for autocomplete and assisted discovery UIs.',
        parameters: [
          queryParameter({
            name: 'query',
            description: 'Partial text entered by the user.',
            schema: {
 type: 'string',
minLength: 1, 
},
            required: true,
          })
        ],
        responseSchema: 'GenericListResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/spaces\/\{space_id\}$/,
    tag: 'Public Spaces',
    methods: {
      GET: {
        access: 'Public',
        summary: 'Get a single space',
        description:
          'Returns the normalized public-facing space record for a single marketplace listing.',
        responseSchema: 'GenericDataResponse',
      },
      PUT: {
        access: 'Authenticated user',
        summary: 'Update a basic space record',
        description:
          'Updates the light-weight `/spaces/{space_id}` record fields used by the simple REST handler.',
        requestBody: requestBody(
          'UpdateSpaceRequest',
          'Partial update payload. At least one supported field must be provided.'
        ),
        responseSchema: 'GenericDataResponse',
      },
      DELETE: {
        access: 'Authenticated user',
        summary: 'Delete a space',
        description:
          'Deletes the space if no relational constraints block removal and invalidates cached listings.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/spaces\/\{space_id\}\/amenities$/,
    tag: 'Public Spaces',
    methods: {
      GET: {
        access: 'Public',
        summary: 'List space amenities',
        description:
          'Returns amenity choices attached to the specified space.',
        responseSchema: 'GenericListResponse',
      },
      POST: {
        access: 'Authenticated user',
        summary: 'Attach an amenity to a space',
        description:
          'Creates a new amenity association for the specified space.',
        requestBody: requestBody(
          'AmenityAssignmentRequest',
          'Amenity attachment payload.',
          true
        ),
        responseSchema: 'GenericDataResponse',
        successStatus: 201,
      },
    },
  },
  {
    pattern: /^\/api\/v1\/spaces\/\{space_id\}\/amenities\/\{amenity_id\}$/,
    tag: 'Public Spaces',
    methods: {
      DELETE: {
        access: 'Authenticated user',
        summary: 'Detach an amenity from a space',
        description:
          'Removes a specific amenity association from the specified space.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/spaces\/\{space_id\}\/areas$/,
    tag: 'Public Spaces',
    methods: {
      GET: {
        access: 'Public',
        summary: 'List areas for a space',
        description:
          'Returns reservable areas for a space, including capacity and configuration metadata used by the booking flow.',
        responseSchema: 'GenericListResponse',
      },
      POST: {
        access: 'Authenticated user',
        summary: 'Create an area',
        description:
          'Creates an area within the specified space.',
        requestBody: requestBody(
          'AreaInput',
          'Area creation payload.'
        ),
        responseSchema: 'GenericDataResponse',
        successStatus: 201,
      },
    },
  },
  {
    pattern: /^\/api\/v1\/spaces\/\{space_id\}\/areas\/\{area_id\}$/,
    tag: 'Public Spaces',
    methods: {
      PUT: {
        access: 'Authenticated user',
        summary: 'Update an area',
        description:
          'Updates the specified area record.',
        requestBody: requestBody(
          'AreaInput',
          'Area update payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
      DELETE: {
        access: 'Authenticated user',
        summary: 'Delete an area',
        description:
          'Deletes the specified area.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/spaces\/\{space_id\}\/areas\/\{area_id\}\/rates$/,
    tag: 'Public Spaces',
    methods: {
      GET: {
        access: 'Public',
        summary: 'Base rates have been removed',
        description:
          'This legacy endpoint now returns `410 Gone`. Base-rate rows were removed in favor of declarative pricing rules.',
        responseSchema: 'ErrorResponse',
        successStatus: 410,
        deprecated: true,
      },
      POST: {
        access: 'Authenticated user',
        summary: 'Base rates have been removed',
        description:
          'This legacy endpoint now returns `410 Gone`. Create pricing rules under `/api/v1/partner/spaces/{space_id}/pricing-rules` instead.',
        responseSchema: 'ErrorResponse',
        successStatus: 410,
        deprecated: true,
      },
    },
  },
  {
    pattern: /^\/api\/v1\/spaces\/\{space_id\}\/areas\/\{area_id\}\/rates\/\{rate_id\}$/,
    tag: 'Public Spaces',
    methods: {
      PUT: {
        access: 'Authenticated user',
        summary: 'Base rates have been removed',
        description:
          'This legacy endpoint now returns `410 Gone`. Use pricing rules instead of direct rate rows.',
        responseSchema: 'ErrorResponse',
        successStatus: 410,
        deprecated: true,
      },
      DELETE: {
        access: 'Authenticated user',
        summary: 'Base rates have been removed',
        description:
          'This legacy endpoint now returns `410 Gone`. Use pricing rules instead of direct rate rows.',
        responseSchema: 'ErrorResponse',
        successStatus: 410,
        deprecated: true,
      },
    },
  },
  {
    pattern: /^\/api\/v1\/spaces\/\{space_id\}\/availability$/,
    tag: 'Public Spaces',
    methods: {
      GET: {
        access: 'Public',
        summary: 'List space availability rows',
        description:
          'Returns persisted weekly availability rows for the specified space.',
        responseSchema: 'GenericListResponse',
      },
      POST: {
        access: 'Authenticated user',
        summary: 'Create an availability row',
        description:
          'Creates a single availability row for the specified space.',
        responseSchema: 'GenericDataResponse',
        requestBody: requestBody(
          'SpaceAvailabilityDayInput',
          'Availability row payload.'
        ),
        successStatus: 201,
      },
    },
  },
  {
    pattern: /^\/api\/v1\/spaces\/\{space_id\}\/availability\/\{availability_id\}$/,
    tag: 'Public Spaces',
    methods: {
      PUT: {
        access: 'Authenticated user',
        summary: 'Update an availability row',
        description:
          'Updates the specified availability row.',
        responseSchema: 'GenericDataResponse',
        requestBody: requestBody(
          'SpaceAvailabilityDayInput',
          'Updated availability row payload.'
        ),
      },
      DELETE: {
        access: 'Authenticated user',
        summary: 'Delete an availability row',
        description:
          'Deletes the specified availability row.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/spaces\/\{space_id\}\/reviews$/,
    tag: 'Public Spaces',
    methods: {
      GET: {
        access: 'Public',
        summary: 'List reviews for a space',
        description:
          'Returns review aggregates, review detail rows, and the current viewer review state for the specified space.',
        parameters: [
          queryParameter({
            name: 'limit',
            description: 'Maximum number of reviews to return.',
            schema: {
 type: 'integer',
minimum: 1,
maximum: 100,
default: 50, 
},
          }),
          queryParameter({
            name: 'cursor',
            description: 'Review UUID cursor from the previous page.',
            schema: UUID_SCHEMA,
          }),
          queryParameter({
            name: 'rating',
            description: 'Optional star rating filter.',
            schema: {
 type: 'integer',
minimum: 1,
maximum: 5, 
},
          }),
          queryParameter({
            name: 'sort',
            description: 'Sort order for the returned reviews.',
            schema: {
              type: 'string',
              enum: ['newest', 'oldest', 'highest', 'lowest'],
              default: 'newest',
            },
          })
        ],
        responseSchema: 'ReviewListResponse',
      },
      POST: {
        access: 'Authenticated customer',
        summary: 'Create a review',
        description:
          'Creates a customer review for the specified space once the underlying booking rules are satisfied.',
        requestBody: requestBody(
          'CreateReviewRequest',
          'Customer review payload.'
        ),
        responseSchema: 'GenericDataResponse',
        successStatus: 201,
      },
    },
  },
  {
    pattern: /^\/api\/v1\/bookings$/,
    tag: 'Bookings',
    methods: {
      GET: {
        access: 'Authenticated customer, partner, or admin',
        summary: 'List bookings',
        description:
          'Returns bookings scoped to the signed-in actor. Customers see their own bookings, partners see space bookings they own, and admins see the full set.',
        parameters: [
          queryParameter({
            name: 'cursor',
            description: 'Booking UUID cursor from the previous page.',
            schema: UUID_SCHEMA,
          }),
          queryParameter({
            name: 'limit',
            description: 'Maximum number of bookings to return.',
            schema: {
 type: 'integer',
minimum: 1,
maximum: 100,
default: 50, 
},
          })
        ],
        responseSchema: 'BookingListResponse',
      },
      POST: {
        access: 'Authenticated customer',
        summary: 'Create a booking',
        description:
          'Creates a new booking, evaluates pricing rules, checks occupancy rules, and may create downstream checkout records.',
        requestBody: requestBody(
          'CreateBookingRequest',
          'Booking request payload.'
        ),
        responseSchema: 'GenericDataResponse',
        successStatus: 201,
      },
      PATCH: {
        access: 'Authenticated partner or admin',
        summary: 'Bulk update booking statuses',
        description:
          'Updates one or more bookings through allowed state transitions and records optional cancellation reasons.',
        requestBody: requestBody(
          'BulkBookingStatusUpdateRequest',
          'Bulk booking status payload.'
        ),
        responseSchema: 'BookingListResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/bookings\/\{booking_id\}$/,
    tag: 'Bookings',
    methods: {
      GET: {
        access: 'Authenticated customer',
        summary: 'Get booking detail',
        description:
          'Returns the detailed customer-facing booking record for the supplied booking UUID.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/bookings\/\{booking_id\}\/cancel$/,
    tag: 'Bookings',
    methods: {
      POST: {
        access: 'Authenticated customer, partner, or admin',
        summary: 'Cancel a booking',
        description:
          'Cancels a booking, captures the cancellation reason, and triggers the downstream notification and refund workflow where applicable.',
        requestBody: requestBody(
          'CancelBookingRequest',
          'Cancellation payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/bookings\/\{booking_id\}\/receipt$/,
    tag: 'Bookings',
    methods: {
      GET: {
        access: 'Authenticated customer or partner',
        summary: 'Get a booking receipt',
        description:
          'Returns a receipt or payment-summary representation for the specified booking.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/bookings\/\{booking_id\}\/reschedule$/,
    tag: 'Bookings',
    methods: {
      PATCH: {
        access: 'Authenticated customer or partner',
        summary: 'Reschedule a booking',
        description:
          'Updates the booking time window and re-runs availability checks before saving the new schedule.',
        requestBody: requestBody(
          'BookingRescheduleRequest',
          'Reschedule payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/bookmarks$/,
    tag: 'Bookmarks',
    methods: {
      POST: {
        access: 'Authenticated customer',
        summary: 'Bookmark a space',
        description:
          'Creates a bookmark for the signed-in customer.',
        requestBody: requestBody(
          'BookmarkMutationRequest',
          'Bookmark creation payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
      DELETE: {
        access: 'Authenticated customer',
        summary: 'Remove a bookmark',
        description:
          'Deletes a bookmark for the signed-in customer.',
        requestBody: requestBody(
          'BookmarkMutationRequest',
          'Bookmark deletion payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/notifications$/,
    tag: 'Notifications',
    methods: {
      GET: {
        access: 'Authenticated user',
        summary: 'List notifications',
        description:
          'Returns the signed-in user notification feed with cursor pagination and optional type/unread filters.',
        parameters: [
          queryParameter({
            name: 'cursor',
            description: 'Notification UUID cursor from the previous page.',
            schema: UUID_SCHEMA,
          }),
          queryParameter({
            name: 'limit',
            description: 'Maximum number of notifications to return.',
            schema: {
 type: 'integer',
minimum: 1,
maximum: 100,
default: 25, 
},
          }),
          queryParameter({
            name: 'type',
            description: 'Optional notification type filter.',
            schema: {
 type: 'string',
enum: ['booking_confirmed', 'booking_received', 'message', 'system'], 
},
          }),
          queryParameter({
            name: 'unread',
            description: 'Set to `true` to only return unread notifications.',
            schema: { type: 'boolean', },
          })
        ],
        responseSchema: 'NotificationListResponse',
      },
      PATCH: {
        access: 'Authenticated user',
        summary: 'Mark one notification read or unread',
        description:
          'Updates the read state for a single notification owned by the signed-in user.',
        requestBody: requestBody(
          'NotificationUpdateRequest',
          'Notification read-state mutation payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
      DELETE: {
        access: 'Authenticated user',
        summary: 'Delete a notification',
        description:
          'Deletes a single notification owned by the signed-in user.',
        requestBody: requestBody(
          'NotificationDeleteRequest',
          'Notification deletion payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/notifications\/mark-all$/,
    tag: 'Notifications',
    methods: {
      PATCH: {
        access: 'Authenticated user',
        summary: 'Mark all notifications as read',
        description:
          'Bulk-updates all unread notifications for the signed-in user.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/complaints$/,
    tag: 'Complaints',
    methods: {
      GET: {
        access: 'Authenticated customer',
        summary: 'List customer complaints',
        description:
          'Returns booking complaints filed by the signed-in customer with cursor pagination.',
        parameters: [
          queryParameter({
            name: 'cursor',
            description: 'Complaint UUID cursor from the previous page.',
            schema: UUID_SCHEMA,
          }),
          queryParameter({
            name: 'limit',
            description: 'Maximum number of complaints to return.',
            schema: {
 type: 'integer',
minimum: 1,
maximum: 100,
default: 20, 
},
          })
        ],
        responseSchema: 'ComplaintListResponse',
      },
      POST: {
        access: 'Authenticated customer',
        summary: 'Create a complaint',
        description:
          'Creates a new booking complaint and routes it into the partner/admin moderation workflow.',
        requestBody: requestBody(
          'CreateComplaintRequest',
          'Complaint creation payload.'
        ),
        responseSchema: 'GenericDataResponse',
        successStatus: 201,
      },
    },
  },
  {
    pattern: /^\/api\/v1\/partner\/complaints$/,
    tag: 'Complaints',
    methods: {
      GET: {
        access: 'Authenticated partner',
        summary: 'List partner complaints',
        description:
          'Returns complaints against the signed-in partner’s bookings with status and cursor filters.',
        parameters: [
          queryParameter({
            name: 'status',
            description: 'Complaint status filter.',
            schema: { type: 'string', },
          }),
          queryParameter({
            name: 'cursor',
            description: 'Complaint UUID cursor from the previous page.',
            schema: UUID_SCHEMA,
          }),
          queryParameter({
            name: 'limit',
            description: 'Maximum number of complaints to return.',
            schema: {
 type: 'integer',
minimum: 1,
maximum: 100,
default: 20, 
},
          })
        ],
        responseSchema: 'ComplaintListResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/partner\/complaints\/\{complaint_id\}$/,
    tag: 'Complaints',
    methods: {
      PATCH: {
        access: 'Authenticated partner',
        summary: 'Resolve or escalate a complaint',
        description:
          'Lets the space partner resolve a complaint directly or escalate it for admin review.',
        requestBody: requestBody(
          'PartnerComplaintActionRequest',
          'Partner complaint action payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/admin\/complaints$/,
    tag: 'Admin',
    methods: {
      GET: {
        access: 'Authenticated admin',
        summary: 'List escalated complaints',
        description:
          'Returns escalated complaints for the admin complaint queue with status and cursor filters.',
        parameters: [
          queryParameter({
            name: 'status',
            description: 'Complaint status filter.',
            schema: { type: 'string', },
          }),
          queryParameter({
            name: 'cursor',
            description: 'Complaint UUID cursor from the previous page.',
            schema: UUID_SCHEMA,
          }),
          queryParameter({
            name: 'limit',
            description: 'Maximum number of complaints to return.',
            schema: {
 type: 'integer',
minimum: 1,
maximum: 100,
default: 20, 
},
          })
        ],
        responseSchema: 'ComplaintListResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/admin\/complaints\/\{complaint_id\}$/,
    tag: 'Admin',
    methods: {
      PATCH: {
        access: 'Authenticated admin',
        summary: 'Resolve or dismiss a complaint',
        description:
          'Lets an administrator resolve an escalated complaint or dismiss it with a moderator note.',
        requestBody: requestBody(
          'AdminComplaintActionRequest',
          'Admin complaint action payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/chat\/rooms$/,
    tag: 'Chat',
    methods: {
      GET: {
        access: 'Authenticated user',
        summary: 'List chat rooms',
        description:
          'Returns chat rooms visible to the signed-in user, optionally scoped to a specific space.',
        parameters: [
          queryParameter({
            name: 'space_id',
            description: 'Optional space UUID to scope the returned rooms.',
            schema: UUID_SCHEMA,
          })
        ],
        responseSchema: 'GenericListResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/chat\/messages$/,
    tag: 'Chat',
    methods: {
      GET: {
        access: 'Authenticated user',
        summary: 'List messages in a room',
        description:
          'Returns message history for the specified room.',
        parameters: [
          queryParameter({
            name: 'room_id',
            description: 'Chat room UUID.',
            schema: UUID_SCHEMA,
            required: true,
          })
        ],
        responseSchema: 'GenericListResponse',
      },
      POST: {
        access: 'Authenticated user',
        summary: 'Send a chat message',
        description:
          'Creates a new chat message and resolves the room when this is the first message in a conversation.',
        requestBody: requestBody(
          'ChatMessageRequest',
          'Chat message payload.'
        ),
        responseSchema: 'GenericDataResponse',
        successStatus: 201,
      },
    },
  },
  {
    pattern: /^\/api\/v1\/chat\/reports$/,
    tag: 'Chat',
    methods: {
      POST: {
        access: 'Authenticated user',
        summary: 'Report a chat conversation',
        description:
          'Creates a moderation report for the specified room and reported user.',
        requestBody: requestBody(
          'ChatReportRequest',
          'Chat moderation report payload.'
        ),
        responseSchema: 'GenericDataResponse',
        successStatus: 201,
      },
    },
  },
  {
    pattern: /^\/api\/v1\/ai-assistant$/,
    tag: 'AI',
    methods: {
      POST: {
        access: 'Public or authenticated user',
        summary: 'Run the marketplace AI assistant',
        description:
          'Sends a query or multi-turn message history to the UpSpace assistant. The assistant can search spaces, compare options, validate availability, create checkout intents, and continue persisted conversations.',
        requestBody: requestBody(
          'AiAssistantRequest',
          'AI assistant request payload.'
        ),
        responseSchema: 'AiAssistantResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/ai-search$/,
    tag: 'AI',
    methods: {
      POST: {
        access: 'Public or authenticated user',
        summary: 'Deprecated AI search alias',
        description:
          'Deprecated alias that re-exports the AI assistant POST handler. Prefer `/api/v1/ai-assistant` for new integrations.',
        requestBody: requestBody(
          'AiAssistantRequest',
          'AI assistant request payload.'
        ),
        responseSchema: 'AiAssistantResponse',
        deprecated: true,
      },
    },
  },
  {
    pattern: /^\/api\/v1\/ai\/conversations$/,
    tag: 'AI',
    methods: {
      GET: {
        access: 'Authenticated user',
        summary: 'List persisted AI conversations',
        description:
          'Returns up to the most recent persisted AI conversations for the signed-in user.',
        responseSchema: 'GenericDataResponse',
      },
      POST: {
        access: 'Authenticated user',
        summary: 'Create a persisted AI conversation',
        description:
          'Creates an empty AI conversation shell that can be reused by future assistant turns.',
        requestBody: requestBody(
          'AiConversationCreateRequest',
          'AI conversation creation payload.'
        ),
        responseSchema: 'GenericDataResponse',
        successStatus: 201,
      },
    },
  },
  {
    pattern: /^\/api\/v1\/ai\/conversations\/\{id\}$/,
    tag: 'AI',
    methods: {
      GET: {
        access: 'Authenticated user',
        summary: 'Get a persisted AI conversation',
        description:
          'Returns the stored conversation metadata and message history for the specified AI conversation.',
        responseSchema: 'GenericDataResponse',
      },
      PATCH: {
        access: 'Authenticated user',
        summary: 'Rename an AI conversation',
        description:
          'Updates the conversation title used in the assistant sidebar.',
        requestBody: requestBody(
          'AiConversationUpdateRequest',
          'AI conversation rename payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
      DELETE: {
        access: 'Authenticated user',
        summary: 'Soft-delete an AI conversation',
        description:
          'Soft-deletes the specified conversation for the signed-in user.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/amenities\/choices$/,
    tag: 'Amenities',
    methods: {
      GET: {
        access: 'Public',
        summary: 'List amenity choices',
        description:
          'Returns the amenity-choice catalog used by forms, filters, and AI reference data.',
        responseSchema: 'GenericListResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/reviews\/tags$/,
    tag: 'Amenities',
    methods: {
      GET: {
        access: 'Public',
        summary: 'List review quick tags',
        description:
          'Returns the common review-tag options used by the customer review form.',
        responseSchema: 'GenericListResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/auth\/signup\/check-email$/,
    tag: 'Auth',
    methods: {
      POST: {
        access: 'Public',
        summary: 'Check sign-up email availability',
        description:
          'Validates whether an email address can be used for a new account.',
        requestBody: requestBody(
          'AuthEmailRequest',
          'Email validation payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/auth\/signup\/send-otp$/,
    tag: 'Auth',
    methods: {
      POST: {
        access: 'Public',
        summary: 'Send sign-up email OTP',
        description:
          'Generates and emails a one-time password used by the sign-up flow.',
        requestBody: requestBody(
          'AuthEmailRequest',
          'OTP request payload.'
        ),
        responseSchema: 'MessageResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/auth\/signup$/,
    tag: 'Auth',
    methods: {
      POST: {
        access: 'Public',
        summary: 'Create a user account',
        description:
          'Creates a new Supabase-authenticated user, ensures the UpSpace profile row exists, and signs the user in.',
        requestBody: requestBody(
          'SignupRequest',
          'Validated sign-up payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/auth\/profile$/,
    tag: 'Auth',
    methods: {
      GET: {
        access: 'Authenticated user',
        summary: 'Get the current profile',
        description:
          'Returns the current signed-in user profile used by client-side role routing and profile screens.',
        responseSchema: 'GenericDataResponse',
      },
      PATCH: {
        access: 'Authenticated user',
        summary: 'Update the current profile',
        description:
          'Updates mutable profile fields for the current user.',
        requestBody: requestBody(
          'AuthProfilePatchRequest',
          'Profile patch payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/auth\/sync-profile$/,
    tag: 'Auth',
    methods: {
      POST: {
        access: 'Authenticated user',
        summary: 'Sync profile from auth session',
        description:
          'Ensures the internal UpSpace user profile row is synchronized with the current Supabase auth session.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/auth\/deactivate$/,
    tag: 'Auth',
    methods: {
      POST: {
        access: 'Authenticated user',
        summary: 'Request account deactivation',
        description:
          'Creates a deactivation request and triggers the downstream offboarding workflow.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/auth\/reactivate$/,
    tag: 'Auth',
    methods: {
      POST: {
        access: 'Authenticated user or approved email holder',
        summary: 'Reactivate an account',
        description:
          'Reactivates an account when the current business rules allow the operation.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/auth\/delete$/,
    tag: 'Auth',
    methods: {
      POST: {
        access: 'Authenticated user',
        summary: 'Request permanent account deletion',
        description:
          'Starts the data-deletion workflow for the signed-in user.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/customer\/transactions$/,
    tag: 'Transactions',
    methods: {
      GET: {
        access: 'Authenticated customer',
        summary: 'List customer transactions',
        description:
          'Returns customer-facing transaction history records for booking payments and refunds.',
        responseSchema: 'GenericListResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/financial\/checkout$/,
    tag: 'Financial',
    methods: {
      POST: {
        access: 'Authenticated customer',
        summary: 'Create a checkout session',
        description:
          'Creates a provider-backed checkout intent for a booking and returns the data required to continue the Xendit payment flow.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/financial\/provider-account$/,
    tag: 'Financial',
    methods: {
      POST: {
        access: 'Authenticated partner',
        summary: 'Create or sync a provider payout account',
        description:
          'Creates or refreshes the partner payout account used for wallet payouts.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/financial\/provider-account\/status$/,
    tag: 'Financial',
    methods: {
      GET: {
        access: 'Authenticated partner',
        summary: 'Get provider payout-account status',
        description:
          'Returns the current provider-backed payout-account state and optionally forces a refresh from Xendit.',
        parameters: [
          queryParameter({
            name: 'refresh',
            description: 'Set to `1` to force a provider refresh before returning data.',
            schema: {
 type: 'string',
enum: ['1'], 
},
          })
        ],
        responseSchema: 'ProviderAccountStatusResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/financial\/payout-channels$/,
    tag: 'Financial',
    methods: {
      GET: {
        access: 'Authenticated partner',
        summary: 'List supported payout channels',
        description:
          'Returns payout channels available from the current financial provider configuration.',
        responseSchema: 'GenericListResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/wallet$/,
    tag: 'Wallet',
    methods: {
      GET: {
        access: 'Authenticated partner',
        summary: 'Get wallet dashboard data',
        description:
          'Returns the partner wallet balance, provider account snapshot, paginated transaction history, and aggregate payout statistics.',
        parameters: [
          queryParameter({
            name: 'cursor',
            description: 'Wallet transaction cursor from the previous page.',
            schema: UUID_SCHEMA,
          }),
          queryParameter({
            name: 'limit',
            description: 'Maximum number of transactions to return.',
            schema: {
 type: 'integer',
minimum: 1,
maximum: 100,
default: 25, 
},
          }),
          queryParameter({
            name: 'type',
            description: 'Optional transaction-type filter.',
            schema: {
 type: 'string',
enum: ['cash_in', 'charge', 'refund', 'payout'], 
},
          }),
          queryParameter({
            name: 'status',
            description: 'Optional transaction-status filter.',
            schema: {
 type: 'string',
enum: ['pending', 'succeeded', 'failed'], 
},
          }),
          queryParameter({
            name: 'includeProvider',
            description: 'Whether to include the provider-account view in the response.',
            schema: {
 type: 'boolean',
default: true, 
},
          })
        ],
        responseSchema: 'WalletDashboardResponse',
      },
      POST: {
        access: 'Authenticated partner',
        summary: 'Wallet top-up placeholder',
        description:
          'This route currently responds with `405` because manual wallet top-ups are disabled. Wallet balances are funded only by booking charges.',
        responseSchema: 'MessageResponse',
        successStatus: 405,
      },
    },
  },
  {
    pattern: /^\/api\/v1\/wallet\/stats$/,
    tag: 'Wallet',
    methods: {
      GET: {
        access: 'Authenticated partner',
        summary: 'Get wallet statistics',
        description:
          'Returns wallet aggregates used by lightweight partner widgets and dashboards.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/wallet\/payout$/,
    tag: 'Wallet',
    methods: {
      POST: {
        access: 'Authenticated partner',
        summary: 'Create a payout request',
        description:
          'Creates a payout from the partner wallet to a configured payout destination.',
        requestBody: requestBody(
          'WalletPayoutRequest',
          'Payout creation payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/wallet\/refund$/,
    tag: 'Wallet',
    methods: {
      POST: {
        access: 'Authenticated partner or admin',
        summary: 'Issue a wallet-backed refund',
        description:
          'Creates a refund tied to a booking and mirrors the result into the partner wallet ledger.',
        requestBody: requestBody(
          'WalletRefundRequest',
          'Refund payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/partner\/dashboard-feed$/,
    tag: 'Partner',
    methods: {
      GET: {
        access: 'Authenticated partner',
        summary: 'Get the partner dashboard feed',
        description:
          'Returns the partner dashboard summary cards, feed items, and compact operational alerts.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/partner\/stuck-bookings$/,
    tag: 'Partner',
    methods: {
      GET: {
        access: 'Authenticated partner',
        summary: 'List stuck bookings',
        description:
          'Returns partner bookings that likely require manual operational attention.',
        responseSchema: 'GenericListResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/partner\/spaces$/,
    tag: 'Partner',
    methods: {
      GET: {
        access: 'Authenticated partner',
        summary: 'List partner-owned spaces',
        description:
          'Returns the full partner inventory set, serialized for the partner control panel.',
        responseSchema: 'GenericListResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/partner\/spaces\/\{space_id\}$/,
    tag: 'Partner',
    methods: {
      GET: {
        access: 'Authenticated partner',
        summary: 'Get a partner space',
        description:
          'Returns the partner-owned space record with owner-only fields used by the management UI.',
        responseSchema: 'GenericDataResponse',
      },
      PUT: {
        access: 'Authenticated partner',
        summary: 'Update a partner space',
        description:
          'Updates a partner-owned space with richer owner-side fields than the public space route.',
        requestBody: requestBody(
          'CreateSpaceRequest',
          'Partner space update payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/partner\/spaces\/\{space_id\}\/areas$/,
    tag: 'Partner',
    methods: {
      POST: {
        access: 'Authenticated partner',
        summary: 'Create a partner area',
        description:
          'Creates an area inside a partner-owned space.',
        requestBody: requestBody(
          'AreaInput',
          'Area creation payload.'
        ),
        responseSchema: 'GenericDataResponse',
        successStatus: 201,
      },
    },
  },
  {
    pattern: /^\/api\/v1\/partner\/spaces\/\{space_id\}\/areas\/\{area_id\}$/,
    tag: 'Partner',
    methods: {
      PUT: {
        access: 'Authenticated partner',
        summary: 'Replace a partner area',
        description:
          'Replaces the specified area owned by the signed-in partner.',
        requestBody: requestBody(
          'AreaInput',
          'Area replacement payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
      DELETE: {
        access: 'Authenticated partner',
        summary: 'Delete a partner area',
        description:
          'Deletes the specified area owned by the signed-in partner.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/partner\/spaces\/\{space_id\}\/pricing-rules$/,
    tag: 'Partner',
    methods: {
      GET: {
        access: 'Authenticated partner',
        summary: 'List pricing rules for a space',
        description:
          'Returns all pricing rules defined for the specified partner-owned space.',
        responseSchema: 'GenericListResponse',
      },
      POST: {
        access: 'Authenticated partner',
        summary: 'Create a pricing rule',
        description:
          'Creates a declarative pricing rule for the specified space.',
        requestBody: requestBody(
          'PriceRuleRequest',
          'Pricing-rule creation payload.'
        ),
        responseSchema: 'GenericDataResponse',
        successStatus: 201,
      },
    },
  },
  {
    pattern: /^\/api\/v1\/partner\/spaces\/\{space_id\}\/pricing-rules\/evaluate$/,
    tag: 'Partner',
    methods: {
      POST: {
        access: 'Authenticated partner',
        summary: 'Preview a pricing rule',
        description:
          'Evaluates a pricing rule against a hypothetical booking request without saving the rule.',
        requestBody: requestBody(
          'PriceRuleEvaluationRequest',
          'Pricing-rule evaluation payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/partner\/spaces\/\{space_id\}\/pricing-rules\/\{price_rule_id\}$/,
    tag: 'Partner',
    methods: {
      PUT: {
        access: 'Authenticated partner',
        summary: 'Replace a pricing rule',
        description:
          'Replaces the specified pricing rule definition.',
        requestBody: requestBody(
          'PriceRuleRequest',
          'Pricing-rule replacement payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
      PATCH: {
        access: 'Authenticated partner',
        summary: 'Patch a pricing rule',
        description:
          'Partially updates the specified pricing rule.',
        requestBody: requestBody(
          'PriceRuleRequest',
          'Pricing-rule patch payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
      DELETE: {
        access: 'Authenticated partner',
        summary: 'Delete a pricing rule',
        description:
          'Deletes the specified pricing rule if no relational constraint prevents removal.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/partner\/spaces\/\{space_id\}\/verification$/,
    tag: 'Partner',
    methods: {
      GET: {
        access: 'Authenticated partner',
        summary: 'Get verification documents for a space',
        description:
          'Returns the latest verification record and signed document URLs for the specified partner-owned space.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/partner\/spaces\/\{space_id\}\/verification\/resubmit$/,
    tag: 'Partner',
    methods: {
      POST: {
        access: 'Authenticated partner',
        summary: 'Resubmit verification',
        description:
          'Resubmits verification for a space after the partner has addressed review feedback.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/partner\/spaces\/\{space_id\}\/verification\/withdraw$/,
    tag: 'Partner',
    methods: {
      POST: {
        access: 'Authenticated partner',
        summary: 'Withdraw verification submission',
        description:
          'Withdraws the active verification submission for the specified space.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/partner\/spaces\/\{space_id\}\/unpublish-request$/,
    tag: 'Partner',
    methods: {
      POST: {
        access: 'Authenticated partner',
        summary: 'Request space unpublishing',
        description:
          'Creates an unpublish request for a partner-owned space so administrators can review it.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/admin\/dashboard$/,
    tag: 'Admin',
    methods: {
      GET: {
        access: 'Authenticated admin',
        summary: 'Get the admin dashboard',
        description:
          'Returns cross-domain admin metrics, recent activity, verification counts, and audit-log slices used by the dashboard.',
        parameters: [
          queryParameter({
            name: 'recentPage',
            description: 'Page number for recent collections.',
            schema: {
 type: 'integer',
minimum: 1,
default: 1, 
},
          }),
          queryParameter({
            name: 'recentSize',
            description: 'Page size for recent collections.',
            schema: {
 type: 'integer',
minimum: 1,
maximum: 50,
default: 5, 
},
          }),
          queryParameter({
            name: 'auditPage',
            description: 'Audit-log page number.',
            schema: {
 type: 'integer',
minimum: 1,
default: 1, 
},
          }),
          queryParameter({
            name: 'auditSize',
            description: 'Audit-log page size.',
            schema: {
 type: 'integer',
minimum: 1,
maximum: 50,
default: 12, 
},
          })
        ],
        responseSchema: 'AdminDashboardResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/admin\/reports$/,
    tag: 'Admin',
    methods: {
      GET: {
        access: 'Authenticated admin',
        summary: 'Get admin report aggregates',
        description:
          'Returns report-level aggregates for the requested trailing time window.',
        parameters: [
          queryParameter({
            name: 'days',
            description: 'Trailing day window.',
            schema: {
 type: 'integer',
enum: [7, 30, 90],
default: 30, 
},
          })
        ],
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/admin\/users$/,
    tag: 'Admin',
    methods: {
      GET: {
        access: 'Authenticated admin',
        summary: 'List users',
        description:
          'Returns users for the admin user-management table.',
        responseSchema: 'GenericListResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/admin\/users\/\{user_id\}\/enable$/,
    tag: 'Admin',
    methods: {
      PATCH: {
        access: 'Authenticated admin',
        summary: 'Enable a user',
        description:
          'Re-enables the specified user account.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/admin\/users\/\{user_id\}\/disable$/,
    tag: 'Admin',
    methods: {
      PATCH: {
        access: 'Authenticated admin',
        summary: 'Disable a user',
        description:
          'Disables the specified user account.',
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/admin\/spaces$/,
    tag: 'Admin',
    methods: {
      GET: {
        access: 'Authenticated admin',
        summary: 'List spaces for moderation',
        description:
          'Returns spaces with moderation-facing fields for the admin inventory review UI.',
        responseSchema: 'GenericListResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/admin\/spaces\/\{space_id\}\/visibility$/,
    tag: 'Admin',
    methods: {
      PATCH: {
        access: 'Authenticated admin',
        summary: 'Change space visibility',
        description:
          'Shows or hides a space from the public marketplace and records the moderator reason when supplied.',
        requestBody: requestBody(
          'SpaceVisibilityActionRequest',
          'Visibility action payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/admin\/verifications$/,
    tag: 'Admin',
    methods: {
      GET: {
        access: 'Authenticated admin',
        summary: 'List verification queue entries',
        description:
          'Returns verification submissions awaiting or having completed review.',
        responseSchema: 'GenericListResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/admin\/verifications\/\{verification_id\}$/,
    tag: 'Admin',
    methods: {
      GET: {
        access: 'Authenticated admin',
        summary: 'Get verification detail',
        description:
          'Returns the full verification record used by the admin review dialog.',
        responseSchema: 'GenericDataResponse',
      },
      PATCH: {
        access: 'Authenticated admin',
        summary: 'Review a verification submission',
        description:
          'Approves or rejects a verification submission and optionally sets the approval validity window.',
        requestBody: requestBody(
          'VerificationActionRequest',
          'Verification review payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/admin\/chat-reports$/,
    tag: 'Admin',
    methods: {
      GET: {
        access: 'Authenticated admin',
        summary: 'List chat reports',
        description:
          'Returns moderation reports submitted from conversation threads.',
        responseSchema: 'GenericListResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/admin\/chat-reports\/\{report_id\}$/,
    tag: 'Admin',
    methods: {
      PATCH: {
        access: 'Authenticated admin',
        summary: 'Resolve a chat report',
        description:
          'Updates the status of a chat moderation report.',
        requestBody: requestBody(
          'GenericActionRequest',
          'Chat report action payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/admin\/deactivation-requests$/,
    tag: 'Admin',
    methods: {
      GET: {
        access: 'Authenticated admin',
        summary: 'List deactivation requests',
        description:
          'Returns account deactivation and deletion requests for operational review.',
        responseSchema: 'GenericListResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/admin\/deactivation-requests\/\{request_id\}$/,
    tag: 'Admin',
    methods: {
      PATCH: {
        access: 'Authenticated admin',
        summary: 'Resolve a deactivation request',
        description:
          'Approves or rejects a user deactivation or deletion request.',
        requestBody: requestBody(
          'GenericActionRequest',
          'Deactivation request action payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/admin\/payout-requests$/,
    tag: 'Admin',
    methods: {
      GET: {
        access: 'Authenticated admin',
        summary: 'List payout requests',
        description:
          'Returns partner payout requests with status and cursor filters for finance operations.',
        parameters: [
          queryParameter({
            name: 'status',
            description: 'Payout request status filter.',
            schema: {
 type: 'string',
enum: ['pending', 'succeeded', 'failed'],
default: 'pending', 
},
          }),
          queryParameter({
            name: 'cursor',
            description: 'Payout request cursor.',
            schema: UUID_SCHEMA,
          }),
          queryParameter({
            name: 'limit',
            description: 'Maximum number of requests to return.',
            schema: {
 type: 'integer',
minimum: 1,
maximum: 100,
default: 20, 
},
          })
        ],
        responseSchema: 'GenericListResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/admin\/payout-requests\/\{request_id\}$/,
    tag: 'Admin',
    methods: {
      PATCH: {
        access: 'Authenticated admin',
        summary: 'Resolve a payout request',
        description:
          'Marks a payout as completed or rejected and stores the resolution note when supplied.',
        requestBody: requestBody(
          'AdminPayoutRequestAction',
          'Payout request action payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/admin\/unpublish-requests$/,
    tag: 'Admin',
    methods: {
      GET: {
        access: 'Authenticated admin',
        summary: 'List unpublish requests',
        description:
          'Returns partner-submitted space unpublish requests.',
        responseSchema: 'GenericListResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/admin\/unpublish-requests\/\{request_id\}$/,
    tag: 'Admin',
    methods: {
      PATCH: {
        access: 'Authenticated admin',
        summary: 'Resolve an unpublish request',
        description:
          'Approves or rejects a partner unpublish request.',
        requestBody: requestBody(
          'GenericActionRequest',
          'Unpublish request action payload.'
        ),
        responseSchema: 'GenericDataResponse',
      },
    },
  },
  {
    pattern: /^\/api\/v1\/admin\/reconciliation$/,
    tag: 'Admin',
    methods: {
      GET: {
        access: 'Authenticated admin',
        summary: 'Get reconciliation data',
        description:
          'Returns reconciliation snapshots used by finance review tooling.',
        responseSchema: 'GenericDataResponse',
      },
      POST: {
        access: 'Authenticated admin',
        summary: 'Run reconciliation',
        description:
          'Triggers a reconciliation job or on-demand synchronization with the financial provider.',
        responseSchema: 'GenericDataResponse',
      },
    },
  }
];

function walkRoutes(dir) {
  const files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true, })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkRoutes(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name === 'route.ts') {
      files.push(fullPath);
    }
  }

  return files;
}

function detectMethods(source) {
  const patterns = {
    GET: [
      /export\s+async\s+function\s+GET\b/u,
      /export\s+const\s+GET\s*=\s*async\b/u,
      /export\s*\{\s*GET\s*\}\s*from/u
    ],
    POST: [
      /export\s+async\s+function\s+POST\b/u,
      /export\s+const\s+POST\s*=\s*async\b/u,
      /export\s*\{\s*POST\s*\}\s*from/u
    ],
    PUT: [
      /export\s+async\s+function\s+PUT\b/u,
      /export\s+const\s+PUT\s*=\s*async\b/u,
      /export\s*\{\s*PUT\s*\}\s*from/u
    ],
    PATCH: [
      /export\s+async\s+function\s+PATCH\b/u,
      /export\s+const\s+PATCH\s*=\s*async\b/u,
      /export\s*\{\s*PATCH\s*\}\s*from/u
    ],
    DELETE: [
      /export\s+async\s+function\s+DELETE\b/u,
      /export\s+const\s+DELETE\s*=\s*async\b/u,
      /export\s*\{\s*DELETE\s*\}\s*from/u
    ],
  };

  return METHOD_ORDER.filter((method) => patterns[method].some((pattern) => pattern.test(source)));
}

function routeFromFile(filePath) {
  return filePath
    .replace(ROUTES_ROOT, '')
    .replace(/\\/gu, '/')
    .replace(/\/route\.ts$/u, '')
    .replace(/\[(.+?)\]/gu, '{$1}')
    .replace(/^/u, '/api/v1');
}

function resolveFamily(route) {
  return FAMILY_DOCS.find((family) => family.pattern.test(route)) ?? null;
}

function inferTag(route) {
  if (route.startsWith('/api/v1/admin')) return 'Admin';
  if (route.startsWith('/api/v1/partner')) return 'Partner';
  if (route.startsWith('/api/v1/auth')) return 'Auth';
  if (route.startsWith('/api/v1/bookings')) return 'Bookings';
  if (route.startsWith('/api/v1/wallet')) return 'Wallet';
  if (route.startsWith('/api/v1/financial')) return 'Financial';
  if (route.startsWith('/api/v1/notifications')) return 'Notifications';
  if (route.startsWith('/api/v1/chat')) return 'Chat';
  if (route.startsWith('/api/v1/complaints')) return 'Complaints';
  if (route.startsWith('/api/v1/ai')) return 'AI';
  if (route.startsWith('/api/v1/bookmarks')) return 'Bookmarks';
  if (route.startsWith('/api/v1/customer')) return 'Transactions';
  if (route.startsWith('/api/v1/reviews') || route.startsWith('/api/v1/amenities')) return 'Amenities';
  if (route.startsWith('/api/v1/account')) return 'Account';
  return 'Public Spaces';
}

function extractPathParameters(route) {
  const matches = [...route.matchAll(/\{(.+?)\}/gu)];
  return matches.map((match) => {
    const name = match[1];
    return pathParameter(name, PARAMETER_DESCRIPTIONS[name] ?? `${name} path parameter.`);
  });
}

function buildOperationId(method, route) {
  const normalizedRoute = route
    .replace(/^\/api\/v1\//u, '')
    .split('/')
    .map((segment) => segment.replace(/[{}]/gu, ''))
    .map((segment) => segment.replace(/[^a-zA-Z0-9]+/gu, ' '))
    .map((segment) => segment.replace(/(^\w|\s\w)/gu, (token) => token.replace(/\s/u, '').toUpperCase()))
    .join('');

  return `${method.toLowerCase()}${normalizedRoute}`;
}

function fallbackSummary(method, route) {
  const resource = route
    .replace(/^\/api\/v1\//u, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/[{}]/gu, ''))
    .join(' ');

  const verbs = {
    GET: route.includes('{') ? 'Get' : 'List',
    POST: 'Create',
    PUT: 'Replace',
    PATCH: 'Update',
    DELETE: 'Delete',
  };

  return `${verbs[method]} ${resource}`;
}

function fallbackDescription(method, route, tag) {
  return `Auto-generated documentation for \`${method} ${route}\`. This route belongs to the ${tag} domain. See the README and markdown documentation for workflow-level guidance.`;
}

function accessToSecurity(access) {
  if (!access) return undefined;
  const normalized = access.toLowerCase();
  if (normalized.includes('public')) {
    return undefined;
  }
  return SESSION_SECURITY;
}

function buildResponses(successSchema, successStatus = 200) {
  const responses = {
    [successStatus]: response('Successful response.', successSchema),
    400: response('Invalid request payload or query parameters.', 'ErrorResponse'),
    401: response('Authentication required.', 'ErrorResponse'),
    403: response('Authenticated user does not have permission to perform this action.', 'ErrorResponse'),
    404: response('Requested resource was not found.', 'ErrorResponse'),
    409: response('Conflict while applying the requested change.', 'ErrorResponse'),
    422: response('Semantic validation failed for the request.', 'ErrorResponse'),
    429: response('Rate limit exceeded.', 'ErrorResponse'),
    500: response('Unexpected server-side failure.', 'ErrorResponse'),
  };

  return responses;
}

function buildOperation(route, method) {
  const family = resolveFamily(route);
  const familyMethod = family?.methods?.[method] ?? null;
  const tag = family?.tag ?? inferTag(route);
  const access = familyMethod?.access;
  const descriptionPrefix = access ? `Access: ${access}. ` : '';
  const summary = familyMethod?.summary ?? fallbackSummary(method, route);
  const description = `${descriptionPrefix}${familyMethod?.description ?? fallbackDescription(method, route, tag)}`;
  const parameters = [
    ...extractPathParameters(route),
    ...(familyMethod?.parameters ?? [])
  ];
  const successStatus = familyMethod?.successStatus ?? (method === 'POST' ? 201 : 200);
  const responseSchema = familyMethod?.responseSchema ?? (method === 'GET' ? 'GenericDataResponse' : 'MessageResponse');

  return {
    tags: [tag],
    summary,
    description,
    operationId: buildOperationId(method, route),
    ...(parameters.length ? { parameters, } : {}),
    ...(familyMethod?.requestBody ? { requestBody: familyMethod.requestBody, } : {}),
    ...(familyMethod?.deprecated ? { deprecated: true, } : {}),
    ...(accessToSecurity(access) ? { security: accessToSecurity(access), } : {}),
    responses: buildResponses(responseSchema, successStatus),
  };
}

function generateSpec(routeInventory) {
  const paths = {};

  for (const route of routeInventory) {
    const operations = {};

    for (const method of route.methods) {
      operations[method.toLowerCase()] = buildOperation(route.path, method);
    }

    paths[route.path] = operations;
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'UpSpace API',
      version: '1.0.0',
      description:
        'Comprehensive OpenAPI reference for UpSpace. The spec is generated from the live `src/app/api/v1/**/route.ts` inventory and enriched with domain-specific descriptions so Scalar and the markdown API reference stay aligned.',
    },
    servers: [
      {
        url: '/',
        description: 'Current deployment origin.',
      }
    ],
    tags: TAGS,
    components: {
      securitySchemes: {
        SupabaseSession: {
          type: 'apiKey',
          in: 'cookie',
          name: 'sb-access-token',
          description:
            'Authenticated browser requests typically rely on the Supabase session cookies established by the App Router auth flow. Some server-to-server integrations may instead attach a valid Supabase bearer token.',
        },
      },
      schemas: COMPONENT_SCHEMAS,
    },
    paths,
  };
}

function generateMarkdown(routeInventory) {
  const sections = [];
  const grouped = new Map();

  for (const route of routeInventory) {
    for (const method of route.methods) {
      const operation = buildOperation(route.path, method);
      const tag = operation.tags[0];
      const section = grouped.get(tag) ?? [];
      section.push({
        method,
        path: route.path,
        access: operation.description.startsWith('Access:')
          ? operation.description.slice(8).split('. ')[0]
          : 'See endpoint description',
        summary: operation.summary,
      });
      grouped.set(tag, section);
    }
  }

  sections.push('# API Reference');
  sections.push('');
  sections.push('This document is generated from the live `src/app/api/v1/**/route.ts` inventory.');
  sections.push('It is the markdown companion to the Scalar UI at `/docs` and the machine-readable spec at `/openapi.json`.');
  sections.push('');
  sections.push('## Conventions');
  sections.push('');
  sections.push('- Authentication: most non-public endpoints expect the Supabase session established by the web app. Role-restricted routes are called out in the access column below.');
  sections.push('- Pagination: list endpoints generally use cursor pagination with `limit`, `cursor`, `hasMore`, and `nextCursor` fields.');
  sections.push('- Validation: route handlers use Zod at the boundary. Invalid payloads usually return `400` with either `error`, `message`, or `errors` details.');
  sections.push('- Rate limiting: public catalog routes, partner inventory views, and some suggestion feeds return `429` when throttled.');
  sections.push('- Regeneration: run `pnpm docs:api` after adding, renaming, or removing route handlers.');
  sections.push('');

  for (const tag of TAGS) {
    const rows = grouped.get(tag.name) ?? [];

    if (!rows.length) {
      continue;
    }

    sections.push(`## ${tag.name}`);
    sections.push('');
    sections.push(tag.description);
    sections.push('');
    sections.push('| Method | Path | Access | Summary |');
    sections.push('| --- | --- | --- | --- |');

    for (const row of rows.sort((left, right) => left.path.localeCompare(right.path) || METHOD_ORDER.indexOf(left.method) - METHOD_ORDER.indexOf(right.method))) {
      sections.push(`| \`${row.method}\` | \`${row.path}\` | ${row.access} | ${row.summary} |`);
    }

    sections.push('');
  }

  return sections.join('\n');
}

function main() {
  const routeFiles = walkRoutes(ROUTES_ROOT).sort();
  const routeInventory = routeFiles.map((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');

    return {
      filePath,
      path: routeFromFile(filePath),
      methods: detectMethods(source),
    };
  }).filter((route) => route.methods.length > 0);

  const spec = generateSpec(routeInventory);
  const markdown = generateMarkdown(routeInventory);

  fs.writeFileSync(OPENAPI_OUTPUT, `${JSON.stringify(spec, null, 2)}\n`);
  fs.writeFileSync(MARKDOWN_OUTPUT, `${markdown}\n`);

  console.log(`Generated ${OPENAPI_OUTPUT}`);
  console.log(`Generated ${MARKDOWN_OUTPUT}`);
  console.log(`Documented ${routeInventory.length} routes and ${routeInventory.reduce((total, route) => total + route.methods.length, 0)} operations.`);
}

main();
