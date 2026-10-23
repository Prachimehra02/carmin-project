import { X, Share2, Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productUrl: string;
}

export default function ShareModal({ isOpen, onClose, productName, productUrl }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(productUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOptions = [
    {
      name: 'Facebook',
      icon: '📘',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}`,
    },
    {
      name: 'Twitter',
      icon: '𝕏',
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(productUrl)}&text=Check%20out%20${encodeURIComponent(productName)}`,
    },
    {
      name: 'WhatsApp',
      icon: '💬',
      url: `https://wa.me/?text=${encodeURIComponent(`Check out this ${productName}: ${productUrl}`)}`,
    },
    {
      name: 'Email',
      icon: '✉️',
      url: `mailto:?subject=${encodeURIComponent(productName)}&body=${encodeURIComponent(productUrl)}`,
    },
  ];

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Share2 className="w-6 h-6 text-[#960018]" />
              <h2 className="text-2xl font-bold text-stone-900">Share Product</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-stone-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="mb-6">
            <p className="text-sm text-stone-600 mb-3">Share via social media:</p>
            <div className="grid grid-cols-2 gap-3">
              {shareOptions.map((option) => (
                <a
                  key={option.name}
                  href={option.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-lg border border-stone-200 hover:bg-stone-50 hover:border-[#960018]/30 transition-colors text-center justify-center"
                >
                  <span className="text-xl">{option.icon}</span>
                  <span className="font-medium text-stone-900 text-sm">{option.name}</span>
                </a>
              ))}
            </div>
          </div>

          <div className="border-t border-stone-200 pt-6">
            <p className="text-sm text-stone-600 mb-3">Or copy link:</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={productUrl}
                readOnly
                className="flex-1 px-4 py-2.5 border border-stone-300 rounded-lg bg-stone-50 text-sm text-stone-600 focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-4 py-2.5 bg-[#960018] hover:bg-[#6F0012] text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
