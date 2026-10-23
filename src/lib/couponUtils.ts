import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return Promise.resolve(true);
  } catch {
    document.body.removeChild(textarea);
    return Promise.resolve(false);
  }
}

export function useCopyCoupon() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const navigate = useNavigate();

  const copyCode = async (code: string) => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const applyCoupon = (code: string, destination?: 'cart' | 'checkout') => {
    localStorage.setItem('couponCode', code);
    localStorage.setItem('pendingCouponApply', code);
    navigate(destination === 'cart' ? '/cart' : '/checkout');
  };

  return { copiedCode, copyCode, applyCoupon };
}
