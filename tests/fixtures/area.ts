export const areaFixture = {
  spaceId: '11111111-1111-4111-8111-111111111111',
  areaId: '22222222-2222-4222-8222-222222222222',
  invalidSpaceId: 'space-123',
  invalidAreaId: 'area-123',
  list: [
    {
      id: 'a-1',
      space_id: '11111111-1111-4111-8111-111111111111',
      name: 'Conference Room',
      max_capacity: BigInt(20),
    },
    {
      id: 'a-2',
      space_id: '11111111-1111-4111-8111-111111111111',
      name: 'Hotdesk Zone',
      max_capacity: BigInt(50),
    },
  ],
  createPayload: { name: 'Conference Room', capacity: '20', },
  created: {
    id: '22222222-2222-4222-8222-222222222222',
    space_id: '11111111-1111-4111-8111-111111111111',
    name: 'Conference Room',
    max_capacity: BigInt(20),
  },
  updatePayload: { name: 'Updated Room', capacity: '30', },
  updated: {
    id: '22222222-2222-4222-8222-222222222222',
    space_id: '11111111-1111-4111-8111-111111111111',
    name: 'Updated Room',
    max_capacity: BigInt(30),
  },
};

