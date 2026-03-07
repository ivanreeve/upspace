-- CreateEnum
CREATE TYPE "complaint_category" AS ENUM ('service_quality', 'billing', 'cancellation', 'safety', 'other');

-- CreateEnum
CREATE TYPE "complaint_status" AS ENUM ('pending', 'escalated', 'resolved', 'dismissed');

-- CreateTable
CREATE TABLE "complaint" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "customer_user_id" BIGINT NOT NULL,
    "customer_auth_id" UUID NOT NULL,
    "partner_auth_id" UUID,
    "category" "complaint_category" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "complaint_status" NOT NULL DEFAULT 'pending',
    "escalation_note" TEXT,
    "resolution_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "processed_by_user_id" BIGINT,

    CONSTRAINT "complaint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_complaint_booking" ON "complaint"("booking_id");

-- CreateIndex
CREATE INDEX "idx_complaint_customer_created" ON "complaint"("customer_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_complaint_partner_status_created" ON "complaint"("partner_auth_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_complaint_status_created" ON "complaint"("status", "created_at");

-- AddForeignKey
ALTER TABLE "complaint" ADD CONSTRAINT "complaint_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "complaint" ADD CONSTRAINT "complaint_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "complaint" ADD CONSTRAINT "complaint_processed_by_user_id_fkey" FOREIGN KEY ("processed_by_user_id") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
