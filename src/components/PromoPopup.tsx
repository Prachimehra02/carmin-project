import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Copy, Check, Gift, ArrowRight, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { copyToClipboard } from '../lib/couponUtils';
import { PromoPopup as PromoPopupType, Coupon } from '../types/order';

const SESSION_KEY = 'promo_popup_session';
const PERSIST_KEY = 'promo_popup_persist';

interface PopupState {
  [popupId: string]: {
    dismissedAt?: number;
    lastShown?: number;
  };
}

function readState(key: string): PopupState {
  try {
    const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeState(key: string, state: PopupState) {
  const json = JSON.stringify(state);
  try {
    if (key === SESSION_KEY) sessionStorage.setItem(key, json);
    else localStorage.setItem(key, json);
  } catch {
    /* ignore quota errors */
  }
}

function isMobile(): boolean {
  return window.innerWidth < 768 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export default function PromoPopup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [popup, setPopup] = useState<PromoPopupType | null>(null);
  const [couponData, setCouponData] = useState<Coupon | null>(null);
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  // Holds the popup that has passed eligibility checks and is waiting to be triggered
  const pendingPopupRef = useRef<PromoPopupType | null>(null);
  const pendingCouponRef = useRef<Coupon | null>(null);
  const triggeredRef = useRef(false);
  const triggerCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    checkAndQueuePopup();
    return () => {
      if (triggerCleanupRef.current) triggerCleanupRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const checkAndQueuePopup = async () => {
    try {
      const { data: popups, error } = await supabase
        .from('promo_popups')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error || !popups || popups.length === 0) return;

      const now = new Date();
      const sessionState = readState(SESSION_KEY);
      const persistState = readState(PERSIST_KEY);

      for (const p of popups as PromoPopupType[]) {
        // Date range check
        if (p.start_date && new Date(p.start_date) > now) continue;
        if (p.end_date && new Date(p.end_date) < now) continue;

        // Target audience check
        if (p.target_audience === 'logged_out_only' && user) continue;

        if (p.target_audience === 'new_customers_only' || p.target_audience === 'first_time_visitors') {
          if (user) {
            const { data: hasOrders } = await supabase.rpc('has_completed_orders', {
              p_user_id: user.id,
            });
            if (hasOrders) continue;
          }
        }

        // If the popup references a coupon, fetch it to check first_order_only
        let linkedCoupon: Coupon | null = null;
        if (p.coupon_code) {
          const { data: coupons } = await supabase
            .from('coupons')
            .select('*')
            .ilike('code', p.coupon_code)
            .limit(1);
          if (coupons && coupons.length > 0) {
            linkedCoupon = coupons[0] as Coupon;
            if (linkedCoupon.first_order_only) {
              if (user) {
                const { data: hasOrders } = await supabase.rpc('has_completed_orders', {
                  p_user_id: user.id,
                });
                if (hasOrders) continue;
              }
            }
            if (!linkedCoupon.active) continue;
            if (linkedCoupon.expiry_date && new Date(linkedCoupon.expiry_date) < now) continue;
          }
        }

        // Display frequency check
        const useSession = p.display_frequency === 'once_per_session';
        const state = useSession ? sessionState : persistState;
        const popupState = state[p.id];

        if (popupState) {
          if (p.display_frequency === 'once_until_dismissed' && popupState.dismissedAt) {
            continue;
          }
          if (p.display_frequency === 'once_per_session' && popupState.lastShown) {
            continue;
          }
          if (p.display_frequency === 'once_per_day' && popupState.lastShown) {
            const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
            if (popupState.lastShown > oneDayAgo) continue;
          }
          if (p.display_frequency === 'show_again_after_days' && popupState.lastShown) {
            const xDaysAgo = Date.now() - (p.show_again_after_days || 7) * 24 * 60 * 60 * 1000;
            if (popupState.lastShown > xDaysAgo) continue;
          }
        }

        // This popup passed all eligibility checks — queue it for triggering
        pendingPopupRef.current = p;
        pendingCouponRef.current = linkedCoupon;
        armTrigger(p, useSession, useSession ? sessionState : persistState);
        return;
      }
    } catch (err) {
      console.error('Error checking promo popup:', err);
    }
  };

  // ── Trigger logic: arms the appropriate trigger based on trigger_type ──
  const armTrigger = (
    p: PromoPopupType,
    useSession: boolean,
    storeState: PopupState,
  ) => {
    // Clean up any existing trigger
    if (triggerCleanupRef.current) {
      triggerCleanupRef.current();
      triggerCleanupRef.current = null;
    }

    const showNow = () => {
      if (triggeredRef.current) return;
      triggeredRef.current = true;

      // Record lastShown
      const storeKey = useSession ? SESSION_KEY : PERSIST_KEY;
      const newState = {
        ...storeState,
        [p.id]: { ...storeState[p.id], lastShown: Date.now() },
      };
      writeState(storeKey, newState);

      setPopup(p);
      setCouponData(pendingCouponRef.current);
      // Small RAF delay so the backdrop transition is visible
      requestAnimationFrame(() => setVisible(true));
    };

    const delaySec = isMobile() ? p.mobile_delay_seconds : p.desktop_delay_seconds;

    if (p.trigger_type === 'time_delay') {
      if (delaySec <= 0) {
        showNow();
      } else {
        const timer = setTimeout(showNow, delaySec * 1000);
        triggerCleanupRef.current = () => clearTimeout(timer);
      }
    } else if (p.trigger_type === 'exit_intent') {
      if (isMobile()) {
        // On mobile, fall back to time delay using the mobile delay setting
        const timer = setTimeout(showNow, Math.max(delaySec, 5) * 1000);
        triggerCleanupRef.current = () => clearTimeout(timer);
      } else {
        const handleMouseLeave = (e: MouseEvent) => {
          // Trigger when mouse leaves through the top of the viewport
          if (e.clientY <= 0) {
            showNow();
          }
        };
        document.addEventListener('mouseleave', handleMouseLeave);
        triggerCleanupRef.current = () => {
          document.removeEventListener('mouseleave', handleMouseLeave);
        };
      }
    } else if (p.trigger_type === 'scroll_percentage') {
      const targetPct = p.scroll_percentage || 50;
      const handleScroll = () => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight > 0) {
          const scrolledPct = (scrollTop / docHeight) * 100;
          if (scrolledPct >= targetPct) {
            showNow();
            window.removeEventListener('scroll', handleScroll);
          }
        }
      };
      // Check immediately in case the page is already scrolled past the target
      handleScroll();
      if (!triggeredRef.current) {
        window.addEventListener('scroll', handleScroll, { passive: true });
        triggerCleanupRef.current = () => {
          window.removeEventListener('scroll', handleScroll);
        };
      }
    }
  };

  const handleClose = useCallback(() => {
    setVisible(false);
    if (popup) {
      const useSession = popup.display_frequency === 'once_per_session';
      const key = useSession ? SESSION_KEY : PERSIST_KEY;
      const state = readState(key);
      state[popup.id] = { ...state[popup.id], dismissedAt: Date.now() };
      writeState(key, state);
    }
    setTimeout(() => {
      setPopup(null);
      setCouponData(null);
      setCopied(false);
    }, 300);
  }, [popup]);

  const handleCopy = async () => {
    if (!popup?.coupon_code) return;
    const success = await copyToClipboard(popup.coupon_code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShopNow = () => {
    if (popup?.coupon_code) {
      localStorage.setItem('couponCode', popup.coupon_code);
      localStorage.setItem('pendingCouponApply', popup.coupon_code);
    }
    handleClose();
    navigate(popup?.cta_destination || '/products');
  };

  if (!popup) return null;

  const discountText =
    popup.discount_text ||
    (couponData
      ? couponData.type === 'percentage'
        ? `${couponData.value}% OFF`
        : `₹${couponData.value} OFF`
      : 'Special Offer');

  const hasMinOrder =
    (couponData && couponData.minimum_order_amount > 0) || popup.minimum_order_value > 0;
  const minOrderValue = couponData?.minimum_order_amount || popup.minimum_order_value || 0;

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        } bg-black/60 backdrop-blur-sm`}
        onClick={handleClose}
      />

      <div className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none">
        <div
          className={`relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden pointer-events-auto transition-all duration-300 ${
            visible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white flex items-center justify-center transition-all hover:scale-110"
            aria-label="Close popup"
          >
            <X className="w-5 h-5" />
          </button>

          <div
            className="relative h-48 flex flex-col items-center justify-center overflow-hidden"
            style={
              popup.background_url
                ? {
                    backgroundImage: `url(${popup.background_url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : undefined
            }
          >
            {!popup.background_url && (
              <div className="absolute inset-0 bg-gradient-to-br from-[#960018] via-[#7A0010] to-[#5C000C]" />
            )}
            {popup.background_url && <div className="absolute inset-0 bg-black/40" />}

            <div className="absolute top-4 left-4 opacity-30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="absolute bottom-6 right-6 opacity-20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>

            <div className="relative z-10 text-center px-6">
              <div className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center mx-auto mb-3">
                <Gift className="w-7 h-7 text-white" />
              </div>
              <p className="text-white text-xs font-semibold uppercase tracking-[0.2em]">
                {discountText}
              </p>
            </div>
          </div>

          <div className="p-7 text-center">
            <h2 className="text-2xl font-bold text-stone-900 mb-2 leading-tight">
              {popup.title}
            </h2>
            {popup.subtitle && (
              <p className="text-stone-500 text-sm mb-5 leading-relaxed">{popup.subtitle}</p>
            )}

            {popup.coupon_code && (
              <div className="mb-5">
                <p className="text-xs text-stone-400 mb-2.5 uppercase tracking-wide font-medium">
                  Use code
                </p>
                <div className="flex items-center gap-2 sm:gap-3 max-w-sm mx-auto">
                  <div className="flex-1 border-2 border-dashed border-[#960018]/40 rounded-xl px-4 py-3 bg-[#960018]/5">
                    <span className="font-mono font-bold text-lg text-[#960018] tracking-wider">
                      {popup.coupon_code}
                    </span>
                  </div>
                  <button
                    onClick={handleCopy}
                    className={`flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                      copied
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-stone-900 text-white hover:bg-stone-800 active:scale-95'
                    }`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleShopNow}
              className="w-full flex items-center justify-center gap-2 bg-[#960018] hover:bg-[#7A0010] text-white font-semibold py-3.5 rounded-xl transition-all hover:shadow-lg active:scale-[0.98]"
            >
              {popup.cta_button_text || 'Shop Now'}
              <ArrowRight className="w-4 h-4" />
            </button>

            {hasMinOrder && minOrderValue > 0 && (
              <p className="text-xs text-stone-400 mt-4">
                Minimum order value ₹{Number(minOrderValue).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
