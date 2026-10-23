/*
# Add configurable trigger settings to promo_popups

Adds trigger_type, desktop_delay_seconds, mobile_delay_seconds, and
scroll_percentage columns so admins can control when a popup appears
instead of it always firing immediately on page load.

trigger_type values:
  - 'time_delay'     : show after N seconds (desktop/mobile independently)
  - 'exit_intent'    : show when the mouse leaves the viewport (desktop)
                       or after 30s of inactivity (mobile fallback)
  - 'scroll_percentage' : show after the user scrolls past X% of the page

Defaults preserve backward compatibility:
  trigger_type defaults to 'time_delay'
  desktop_delay_seconds defaults to 5
  mobile_delay_seconds defaults to 8
  scroll_percentage defaults to 50
*/

ALTER TABLE promo_popups
  ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'time_delay'
    CHECK (trigger_type IN ('time_delay','exit_intent','scroll_percentage'));

ALTER TABLE promo_popups
  ADD COLUMN IF NOT EXISTS desktop_delay_seconds integer NOT NULL DEFAULT 5;

ALTER TABLE promo_popups
  ADD COLUMN IF NOT EXISTS mobile_delay_seconds integer NOT NULL DEFAULT 8;

ALTER TABLE promo_popups
  ADD COLUMN IF NOT EXISTS scroll_percentage integer NOT NULL DEFAULT 50;

-- Ensure scroll_percentage is in a valid range
ALTER TABLE promo_popups
  ADD CONSTRAINT promo_popups_scroll_range
    CHECK (scroll_percentage >= 1 AND scroll_percentage <= 100);

-- Ensure delays are non-negative
ALTER TABLE promo_popups
  ADD CONSTRAINT promo_popups_desktop_delay_nonneg
    CHECK (desktop_delay_seconds >= 0);

ALTER TABLE promo_popups
  ADD CONSTRAINT promo_popups_mobile_delay_nonneg
    CHECK (mobile_delay_seconds >= 0);
