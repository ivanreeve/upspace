type MockUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
};

const USERS: MockUser[] = [
  {
    id: 'demo-admin',
    email: 'demo@upspace.app',
    name: 'Demo Admin',
    passwordHash:
      '15cdd5a0f982c9defecdae8dffef90fd:a4fa706c16d786b0a0e68dce4cf148c8357a9714e8daffefbde702dfceb609690d9cbbf5990dcce942a62b8858709887f97408c69f161e226828f1e4242f6874',
  },
  {
    id: 'tenant-ops',
    email: 'tenant@upspace.app',
    name: 'Tenant Ops',
    passwordHash:
      'e44a4a4db3f335c4576bb93604a3cb9b:41dc95ecc24b98aa183449e9164318a4e172136d50ece596e39dbd4461a94a2aa0718f344e25ad8dd8ba09aa20f04444b5b3b634c49d4721abccda14c33d8492',
  }
];

export function findMockUserByEmail(email: string): MockUser | undefined {
  return USERS.find((user) => user.email.toLowerCase() === email.toLowerCase());
}
