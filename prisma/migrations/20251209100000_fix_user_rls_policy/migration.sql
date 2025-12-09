ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON "user";

CREATE POLICY "Users can view own profile"
ON "user"
FOR SELECT
USING (auth.uid() = auth_user_id);
