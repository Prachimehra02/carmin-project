-- Prevent duplicate redemptions for the same order
-- (a single order can only have one coupon redemption)
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_redemptions_order_unique
  ON coupon_redemptions(order_id);

-- Add a CHECK constraint so discount_amount is never negative
ALTER TABLE coupon_redemptions
  ADD CONSTRAINT coupon_redemptions_discount_positive
  CHECK (discount_amount >= 0);
