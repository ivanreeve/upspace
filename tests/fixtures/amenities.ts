export const amenitiesFixture = {
  spaceId: '11111111-1111-4111-8111-111111111111',
  amenityId: '22222222-2222-4222-8222-222222222222',
  invalidSpaceId: 'space-123',
  invalidAmenityId: 'amenity-123',
  list: [
    { id: '22222222-2222-4222-8222-222222222222', space_id: '11111111-1111-4111-8111-111111111111', name: 'Quiet rooms', },
    { id: '33333333-3333-4333-8333-333333333333', space_id: '11111111-1111-4111-8111-111111111111', name: 'Fast WiFi', },
  ],
  createPayload: { name: 'Quiet rooms', },
  createdAmenity: {
    id: '22222222-2222-4222-8222-222222222222',
    space_id: '11111111-1111-4111-8111-111111111111',
    name: 'Quiet rooms',
  },
};

