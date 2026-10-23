import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { lookupPincode } from '../lib/pincodeUtils';

export interface AddressFormData {
  full_name: string;
  phone: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  district: string;
  state: string;
  state_code: string;
  country: string;
  pincode: string;
  landmark: string;
  address_type: string;
  is_default: boolean;
}

interface AddressFormProps {
  value: AddressFormData;
  onChange: (value: AddressFormData) => void;
  showLabel?: boolean;
  showDefault?: boolean;
  disabled?: boolean;
  onPincodeVerifiedChange?: (verified: boolean) => void;
}

export default function AddressForm({
  value,
  onChange,
  showLabel = true,
  showDefault = true,
  disabled = false,
  onPincodeVerifiedChange,
}: AddressFormProps) {
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeVerified, setPincodeVerified] = useState(
    !!value.state_code && /^\d{6}$/.test(value.pincode)
  );
  const [pincodeError, setPincodeError] = useState('');

  useEffect(() => {
    const verified =
      !!value.state_code &&
      !!value.state &&
      /^\d{6}$/.test(value.pincode);

    setPincodeVerified(verified);
    onPincodeVerifiedChange?.(verified);
  }, []);

  const updateField = (
    field: keyof AddressFormData,
    fieldValue: string | boolean
  ) => {
    onChange({
      ...value,
      [field]: fieldValue,
    });
  };

  const handlePincodeChange = async (rawValue: string) => {
    const pincode = rawValue.replace(/\D/g, '').slice(0, 6);

    setPincodeVerified(false);
    onPincodeVerifiedChange?.(false);
    setPincodeError('');

    onChange({
      ...value,
      pincode,
      state: '',
      state_code: '',
      district: '',
    });

    if (pincode.length !== 6) {
      return;
    }

    try {
      setPincodeLoading(true);

      const result = await lookupPincode(pincode);

      if (!result || !result.valid) {
        setPincodeError(result?.error || 'Invalid PIN code.');
        return;
      }

      onChange({
        ...value,
        pincode,
        state: result.state || '',
        state_code: result.stateCode || '',
        district: result.district || '',
        city: value.city || result.district || '',
        country: 'India',
      });

      setPincodeVerified(true);
      onPincodeVerifiedChange?.(true);
    } catch (error) {
      console.error('PIN lookup failed:', error);
      setPincodeError('Unable to verify PIN code. Please try again.');
    } finally {
      setPincodeLoading(false);
    }
  };

  return (
    <div className="space-y-4">

      {showLabel && (
        <div>
          <label className="block text-sm font-medium text-stone-900 mb-2">
            Label
          </label>

          <div className="flex gap-2">
            {['Home', 'Work', 'Other'].map((type) => (
              <button
                key={type}
                type="button"
                disabled={disabled}
                onClick={() => updateField('address_type', type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  (value.address_type || 'Home') === type
                    ? 'bg-[#960018] text-white'
                    : 'bg-white border border-stone-300 text-stone-700 hover:border-[#960018]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-stone-900 mb-2">
            Full Name
          </label>

          <input
            type="text"
            required
            disabled={disabled}
            value={value.full_name}
            onChange={(e) => updateField('full_name', e.target.value)}
            className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:border-[#960018]"
            placeholder="John Doe"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-900 mb-2">
            Phone
          </label>

          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            required
            disabled={disabled}
            value={value.phone}
            onChange={(e) =>
              updateField(
                'phone',
                e.target.value.replace(/\D/g, '').slice(0, 10)
              )
            }
            className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:border-[#960018]"
            placeholder="9876543210"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-900 mb-2">
          Address Line 1
        </label>

        <input
          type="text"
          required
          disabled={disabled}
          value={value.address_line_1}
          onChange={(e) => updateField('address_line_1', e.target.value)}
          className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:border-[#960018]"
          placeholder="House no, Building, Street"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-900 mb-2">
          Address Line 2
        </label>

        <input
          type="text"
          disabled={disabled}
          value={value.address_line_2 || ''}
          onChange={(e) => updateField('address_line_2', e.target.value)}
          className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:border-[#960018]"
          placeholder="Area (optional)"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-900 mb-2">
          PIN Code
        </label>

        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            required
            disabled={disabled}
            value={value.pincode}
            onChange={(e) => void handlePincodeChange(e.target.value)}
            className={`w-full px-4 py-2.5 pr-10 border rounded-lg focus:outline-none ${
              pincodeError
                ? 'border-red-400'
                : pincodeVerified
                ? 'border-green-500'
                : 'border-stone-300 focus:border-[#960018]'
            }`}
            placeholder="Enter 6-digit PIN code"
          />

          <div className="absolute right-3 top-3">
            {pincodeLoading && (
              <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
            )}

            {pincodeVerified && !pincodeLoading && (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            )}
          </div>
        </div>

        {pincodeError && (
          <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {pincodeError}
          </p>
        )}

        {pincodeVerified && (
          <p className="text-xs text-green-600 mt-1">
            PIN code verified
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-stone-900 mb-2">
            City / Area
          </label>

          <input
            type="text"
            required
            disabled={disabled}
            value={value.city}
            onChange={(e) => updateField('city', e.target.value)}
            className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:border-[#960018]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-900 mb-2">
            District
          </label>

          <input
            type="text"
            readOnly
            value={value.district || ''}
            className="w-full px-4 py-2.5 border border-stone-300 rounded-lg bg-stone-100 text-stone-600 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-900 mb-2">
            State
          </label>

          <input
            type="text"
            readOnly
            value={value.state}
            className="w-full px-4 py-2.5 border border-stone-300 rounded-lg bg-stone-100 text-stone-600 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-900 mb-2">
            Country
          </label>

          <input
            type="text"
            value="India"
            readOnly
            className="w-full px-4 py-2.5 border border-stone-300 rounded-lg bg-stone-100 text-stone-600 cursor-not-allowed"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-900 mb-2">
          Landmark
        </label>

        <input
          type="text"
          disabled={disabled}
          value={value.landmark || ''}
          onChange={(e) => updateField('landmark', e.target.value)}
          className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:border-[#960018]"
          placeholder="Near... (optional)"
        />
      </div>

      {showDefault && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value.is_default}
            disabled={disabled}
            onChange={(e) => updateField('is_default', e.target.checked)}
            className="w-4 h-4 rounded border-stone-300 text-[#960018] focus:ring-[#960018]"
          />

          <span className="text-sm text-stone-700">
            Set as default address
          </span>
        </label>
      )}
    </div>
  );
}