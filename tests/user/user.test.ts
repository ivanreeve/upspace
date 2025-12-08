import { describe, expect, it } from 'vitest';
import { user_role, user_status } from '@prisma/client';

import { userFixture } from '../fixtures/user';

describe('User fixture', () => {
  it('matches expected shape', () => {
    expect(userFixture.handle).toMatch(/^[a-z0-9_]{3,}$/);
    expect(userFixture.auth_user_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(userFixture.role).toBe(user_role.customer);
    expect(userFixture.status).toBe(user_status.active);
    expect(userFixture.is_onboard).toBe(false);
  });

  it('has basic profile metadata', () => {
    expect(userFixture.first_name).toBeTruthy();
    expect(userFixture.last_name).toBeTruthy();
    expect(userFixture.updated_at.getTime()).toBeGreaterThanOrEqual(
      userFixture.created_at.getTime()
    );
  });
});
