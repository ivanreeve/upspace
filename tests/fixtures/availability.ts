export const availabilityFixture = {
  spaceId: '11111111-1111-4111-8111-111111111111',
  availabilityId: '22222222-2222-4222-8222-222222222222',
  invalidSpaceId: 'space-123',
  invalidAvailabilityId: 'avail-123',
  list: [
    {
      id: 'a-monday',
      space_id: '11111111-1111-4111-8111-111111111111',
      day_of_week: 0,
      opening: new Date('1970-01-01T08:00:00.000Z'),
      closing: new Date('1970-01-01T18:00:00.000Z'),
    },
    {
      id: 'a-tuesday',
      space_id: '11111111-1111-4111-8111-111111111111',
      day_of_week: 1,
      opening: new Date('1970-01-01T09:00:00.000Z'),
      closing: new Date('1970-01-01T17:00:00.000Z'),
    }
  ],
  createPayload: {
    day_of_week: 'Monday',
    opening_time: '08:00',
    closing_time: '18:00',
  },
  createPayloadArray: [
    {
      day_of_week: 'Monday',
      opening_time: '08:00',
      closing_time: '18:00',
    },
    {
      day_of_week: 'Tuesday',
      opening_time: '09:00',
      closing_time: '17:00',
    }
  ],
  createdRows: [
    {
      id: 'a-created-1',
      space_id: '11111111-1111-4111-8111-111111111111',
      day_of_week: 0,
      opening: new Date('1970-01-01T08:00:00.000Z'),
      closing: new Date('1970-01-01T18:00:00.000Z'),
    }
  ],
  updatedRow: {
    id: '22222222-2222-4222-8222-222222222222',
    space_id: '11111111-1111-4111-8111-111111111111',
    day_of_week: 0,
    opening: new Date('1970-01-01T10:00:00.000Z'),
    closing: new Date('1970-01-01T19:00:00.000Z'),
  },
  existingRow: {
    day_of_week: 0,
    opening: new Date('1970-01-01T08:00:00.000Z'),
    closing: new Date('1970-01-01T18:00:00.000Z'),
  },
};
