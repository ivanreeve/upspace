import { user_role, user_status } from "@prisma/client";

export const userFixture = {
  handle: "user_handle_001",
  auth_user_id: "11111111-1111-1111-1111-111111111111",
  role: user_role.customer,
  status: user_status.active,
  is_onboard: false,
  first_name: "Ada",
  last_name: "Lovelace",
  avatar: "https://example.com/avatar.png",
  created_at: new Date("2024-01-01T00:00:00Z"),
  updated_at: new Date("2024-01-02T00:00:00Z"),
};
