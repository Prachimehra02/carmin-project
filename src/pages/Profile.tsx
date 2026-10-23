import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { supabase } from '../lib/supabase';
import {
  User, Mail, Phone, MapPin, Heart, Package, LogOut, Save, AlertCircle,
  Plus, Pencil, Trash2, Star, Home, X, ChevronRight, Tag,
} from 'lucide-react';
import { Address, Order, OrderStatusDef } from '../types/order';
import MyCoupons from '../components/MyCoupons';
import { lookupPincode } from '../lib/pincodeUtils';

interface UserProfile {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  role?: string;
}

type Tab = 'profile' | 'addresses' | 'wishlist' | 'orders' | 'coupons';

const EMPTY_ADDRESS: Omit<Address, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  full_name: '',
  phone: '',
  address_line_1: '',
  address_line_2: '',
  city: '',
  district: '',
  state: '',
  state_code: '',
  country: 'India',
  pincode: '',
  is_default: false,
  landmark: '',
  address_type: 'Home',
};

export default function Profile() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { items: wishlistItems } = useWishlist();
  const navigate = useNavigate();

  const [profileLoading, setProfileLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [ordersError, setOrdersError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState<UserProfile>({ id: '', full_name: '', phone: '', email: '' });
  const [addresses, setAddresses] = useState<Address[]>([]);

  // Address form state
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState({ ...EMPTY_ADDRESS });
  const [addressError, setAddressError] = useState('');
  const [addressSuccess, setAddressSuccess] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeVerified, setPincodeVerified] = useState(false);
  const [pincodeError, setPincodeError] = useState('');

  useEffect(() => {
  if (!authLoading && !user) {
    navigate('/login', { replace: true });
  }
}, [authLoading, user, navigate]);

  const loadAddresses = useCallback(async () => {
    if (!user) return;
    setAddressesLoading(true);
    try {
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });
      if (error) throw error;
      setAddresses(data || []);
    } catch (err) {
      console.error('Error fetching addresses:', err);
    } finally {
      setAddressesLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadProfile = async () => {
      setProfileLoading(true);
      setProfileError('');
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        if (error) throw error;
        if (!cancelled) {
          if (data) {
            setProfile(data);
          } else {
            setProfile({
              id: user.id,
              full_name: user.user_metadata?.full_name || '',
              phone: user.user_metadata?.phone || '',
              email: user.email || '',
            });
          }
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        if (!cancelled) setProfileError('Failed to load profile. Please try again.');
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    };

    const loadOrders = async () => {
      setOrdersLoading(true);
      setOrdersError('');
      try {
        const { data, error } = await supabase
          .from('orders')
          .select(`
            *,
            order_items (
              id, quantity, price, tax_percentage, tax_amount,
              line_total, product_name, product_sku, product_id
            ),
            order_status_def:order_statuses!orders_order_status_id_fkey ( * ),
            payment_status_def:payment_statuses!orders_payment_status_id_fkey ( * )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (!cancelled) setOrders((data || []) as Order[]);
      } catch (err) {
        console.error('Error fetching orders:', err);
        if (!cancelled) setOrdersError('Failed to load orders. Please try again.');
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    };

    void loadProfile();
    void loadOrders();
    void loadAddresses();

    return () => { cancelled = true; };
  }, [user, loadAddresses]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaveError('');
    setSuccess('');
    try {
      const { data: existingProfile, error: checkError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      if (checkError) throw checkError;

      const profileData = {
        id: user.id,
        full_name: profile.full_name,
        phone: profile.phone,
        email: user.email,
      };

      if (existingProfile) {
        const { error } = await supabase.from('user_profiles').update(profileData).eq('id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_profiles').insert([profileData]);
        if (error) throw error;
      }

      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving profile:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  // ── Address management ──

  const resetAddressForm = () => {
  setAddressForm({ ...EMPTY_ADDRESS });
  setEditingAddressId(null);
  setShowAddressForm(false);
  setAddressError('');
  setAddressSuccess('');

  setPincodeVerified(false);
  setPincodeError('');
};

  const openAddAddressForm = () => {
  setAddressForm({
    ...EMPTY_ADDRESS,
    is_default: addresses.length === 0,
  });

  setEditingAddressId(null);
  setShowAddressForm(true);
  setAddressError('');
  setAddressSuccess('');

  setPincodeVerified(false);
  setPincodeError('');
};

  const openEditAddressForm = (addr: Address) => {
    setAddressForm({
      full_name: addr.full_name,
      phone: addr.phone,
      address_line_1: addr.address_line_1,
      address_line_2: addr.address_line_2 || '',
      city: addr.city,
      district: addr.district || '',
      state: addr.state,
      state_code: addr.state_code || '',
      country: addr.country || 'India',
      pincode: addr.pincode,
      is_default: addr.is_default,
      landmark: addr.landmark || '',
      address_type: addr.address_type || 'Home',
    });

    setPincodeVerified(!!addr.state_code);
    setPincodeError('');
    setEditingAddressId(addr.id);
    setShowAddressForm(true);
    setAddressError('');
    setAddressSuccess('');
  };

  const handleAddressFormChange = (field: string, value: string | boolean) => {
    setAddressForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePincodeLookup = async (pincode: string) => {
  const cleanPincode = pincode.replace(/\D/g, '').slice(0, 6);

  setAddressForm((prev) => ({
    ...prev,
    pincode: cleanPincode,
  }));

  setPincodeVerified(false);
  setPincodeError('');

  // Clear derived fields while PIN is incomplete
  if (cleanPincode.length !== 6) {
    setAddressForm((prev) => ({
      ...prev,
      pincode: cleanPincode,
      state: '',
      state_code: '',
      district: '',
    }));

    return;
  }

  try {
    setPincodeLoading(true);

    const result = await lookupPincode(cleanPincode);

    console.log('PIN lookup result:', result);

    if (!result) {
      setPincodeError('Invalid PIN code.');

      setAddressForm((prev) => ({
        ...prev,
        state: '',
        state_code: '',
        district: '',
      }));

      return;
    }

    console.log('State:', result.state);
    console.log('State code:', result.stateCode);
    console.log('District:', result.district);

    setAddressForm((prev) => ({
      ...prev,
      pincode: cleanPincode,
      state: result.state || '',
      state_code: result.stateCode || '',
      district: result.district || '',
      city: prev.city || result.district || '',
    }));

    setPincodeVerified(true);
  } catch (err) {
    console.error('PIN lookup failed:', err);

    setAddressForm((prev) => ({
      ...prev,
      state: '',
      state_code: '',
      district: '',
    }));

    setPincodeVerified(false);
    setPincodeError(
      'Unable to verify PIN code. Please try again.'
    );
  } finally {
    setPincodeLoading(false);
  }
};

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setAddressError('');
setAddressSuccess('');

if (!addressForm.full_name.trim()) {
  setAddressError('Please enter your full name.');
  return;
}

const phone = addressForm.phone.replace(/\D/g, '');

if (!/^[6-9]\d{9}$/.test(phone)) {
  setAddressError('Please enter a valid 10-digit mobile number.');
  return;
}

if (!addressForm.address_line_1.trim()) {
  setAddressError('Please enter your address.');
  return;
}

if (!/^\d{6}$/.test(addressForm.pincode.trim())) {
  setAddressError('Please enter a valid 6-digit PIN code.');
  return;
}

if (!pincodeVerified) {
  setAddressError('Please enter and verify a valid PIN code.');
  return;
}

if (!addressForm.city.trim()) {
  setAddressError('Please enter your city.');
  return;
}

if (
  !addressForm.state.trim() ||
  !addressForm.state_code
) {
  setAddressError(
    'State could not be verified from the PIN code.'
  );
  return;
}

setSavingAddress(true);
    
    try {
      const payload = {
        user_id: user.id,
        full_name: addressForm.full_name.trim(),
        phone: addressForm.phone.trim(),
        address_line_1: addressForm.address_line_1.trim(),
        address_line_2: addressForm.address_line_2?.trim() || null,
        city: addressForm.city.trim(),
        district: addressForm.district?.trim() || null,
        state: addressForm.state.trim(),
        state_code: addressForm.state_code,
        country: 'India',
        pincode: addressForm.pincode.trim(),
        is_default: addressForm.is_default,
        landmark: addressForm.landmark?.trim() || null,
        address_type: addressForm.address_type || 'Home',
      };

      // If setting as default, unset all other defaults first
      if (addressForm.is_default) {
        const { error: unsetError } = await supabase
          .from('addresses')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .neq('id', editingAddressId || '00000000-0000-0000-0000-000000000000');
        if (unsetError) throw unsetError;
      }

      if (editingAddressId) {
        const { error } = await supabase
          .from('addresses')
          .update(payload)
          .eq('id', editingAddressId);
        if (error) throw error;
        setAddressSuccess('Address updated successfully!');
      } else {
        const { error } = await supabase
          .from('addresses')
          .insert([payload]);
        if (error) throw error;
        setAddressSuccess('Address added successfully!');
      }

      await loadAddresses();
      setTimeout(() => resetAddressForm(), 1000);
    } catch (err) {
      console.error('Error saving address:', err);
      setAddressError(err instanceof Error ? err.message : 'Failed to save address');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this address?')) return;
    try {
      const { error } = await supabase.from('addresses').delete().eq('id', id);
      if (error) throw error;
      await loadAddresses();
      setAddressSuccess('Address deleted.');
      setTimeout(() => setAddressSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting address:', err);
      setAddressError(err instanceof Error ? err.message : 'Failed to delete address');
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!user) return;
    try {
      // Unset all defaults, then set the chosen one
      const { error: unsetError } = await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user.id);
      if (unsetError) throw unsetError;

      const { error: setError } = await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', id);
      if (setError) throw setError;

      await loadAddresses();
    } catch (err) {
      console.error('Error setting default address:', err);
      setAddressError(err instanceof Error ? err.message : 'Failed to set default address');
    }
  };

  if (authLoading) {
  return (
    <div className="min-h-screen flex items-center justify-center pt-24">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-[#960018]" />
    </div>
  );
}

if (profileLoading) {
  return (
    <div className="min-h-screen flex items-center justify-center pt-24">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-[#960018]" />
    </div>
  );
}

  const tabButton = (tab: Tab, icon: React.ReactNode, label: string, badge?: number) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
        activeTab === tab
          ? 'bg-[#960018]/5 text-[#960018] font-semibold'
          : 'text-stone-700 hover:bg-stone-50'
      }`}
    >
      {icon}
      {label}
      {badge != null && badge > 0 && (
        <span className="ml-auto bg-[#960018] text-white text-xs px-2 py-1 rounded-full">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 pt-8 px-4 pb-12">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-stone-900 mb-2">My Account</h1>
          <p className="text-stone-600">{user?.email}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 space-y-2">
              {tabButton('profile', <User className="w-5 h-5" />, 'Profile')}
              {tabButton('addresses', <MapPin className="w-5 h-5" />, 'Addresses', addresses.length)}
              {tabButton('wishlist', <Heart className="w-5 h-5" />, 'Wishlist', wishlistItems.length)}
              {tabButton('orders', <Package className="w-5 h-5" />, 'Orders')}
              {tabButton('coupons', <Tag className="w-5 h-5" />, 'My Coupons')}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            {/* ── Profile tab ── */}
            {activeTab === 'profile' && (
              <div className="bg-white rounded-lg shadow p-8">
                <h2 className="text-2xl font-bold text-stone-900 mb-6">Profile Information</h2>

                {profileError && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-red-800 text-sm">{profileError}</p>
                  </div>
                )}
                {saveError && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-red-800 text-sm">{saveError}</p>
                  </div>
                )}
                {success && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
                    {success}
                  </div>
                )}

                <form onSubmit={handleSaveProfile} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-stone-900 mb-2">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3.5 w-5 h-5 text-stone-400" />
                      <input
                        type="email"
                        value={profile.email}
                        disabled
                        className="w-full pl-10 pr-4 py-2.5 border border-stone-300 rounded-lg bg-stone-50 text-stone-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-900 mb-2">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3.5 w-5 h-5 text-stone-400" />
                      <input
                        type="text"
                        value={profile.full_name}
                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:border-[#960018]"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-900 mb-2">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3.5 w-5 h-5 text-stone-400" />
                      <input
                        type="tel"
                        value={profile.phone}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:border-[#960018]"
                        placeholder="+91 98765 43210"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 bg-[#960018] hover:bg-[#6F0012] disabled:bg-stone-400 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                  >
                    <Save className="w-5 h-5" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </form>
              </div>
            )}

            {/* ── Addresses tab ── */}
            {activeTab === 'addresses' && (
              <div className="bg-white rounded-lg shadow p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-stone-900">My Addresses</h2>
                  {!showAddressForm && (
                    <button
                      onClick={openAddAddressForm}
                      className="flex items-center gap-2 bg-[#960018] hover:bg-[#6F0012] text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Add Address
                    </button>
                  )}
                </div>

                {addressError && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-red-800 text-sm">{addressError}</p>
                  </div>
                )}
                {addressSuccess && !showAddressForm && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
                    {addressSuccess}
                  </div>
                )}

                {/* Address form (add/edit) */}
                {showAddressForm && (
                  <form onSubmit={handleSaveAddress} className="mb-6 p-6 border border-stone-200 rounded-lg bg-stone-50 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-stone-900">
                        {editingAddressId ? 'Edit Address' : 'Add New Address'}
                      </h3>
                      <button type="button" onClick={resetAddressForm} className="text-stone-400 hover:text-stone-600">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {addressSuccess && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
                        {addressSuccess}
                      </div>
                    )}

                    {/* Address type / label */}
                    <div>
                      <label className="block text-sm font-medium text-stone-900 mb-2">Label</label>
                      <div className="flex gap-2">
                        {['Home', 'Work', 'Other'].map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => handleAddressFormChange('address_type', type)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                              (addressForm.address_type || 'Home') === type
                                ? 'bg-[#960018] text-white'
                                : 'bg-white border border-stone-300 text-stone-700 hover:border-[#960018]'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-stone-900 mb-2">Full Name</label>
                        <input
                          type="text"
                          required
                          value={addressForm.full_name}
                          onChange={(e) => handleAddressFormChange('full_name', e.target.value)}
                          className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:border-[#960018]"
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-stone-900 mb-2">Phone</label>
                        <input
  type="tel"
  inputMode="numeric"
  maxLength={10}
  required
  value={addressForm.phone}
  onChange={(e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
    handleAddressFormChange('phone', digitsOnly);
  }}
  className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:border-[#960018]"
  placeholder="9876543210"
/>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-stone-900 mb-2">Address Line 1</label>
                      <input
                        type="text"
                        required
                        value={addressForm.address_line_1}
                        onChange={(e) => handleAddressFormChange('address_line_1', e.target.value)}
                        className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:border-[#960018]"
                        placeholder="House no, Building, Street"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-stone-900 mb-2">Address Line 2</label>
                      <input
                        type="text"
                        value={addressForm.address_line_2 || ''}
                        onChange={(e) => handleAddressFormChange('address_line_2', e.target.value)}
                        className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:border-[#960018]"
                        placeholder="Area, Landmark (optional)"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
  <label className="block text-sm font-medium text-stone-900 mb-2">
    PIN Code
  </label>

  <input
    type="text"
    inputMode="numeric"
    maxLength={6}
    required
    value={addressForm.pincode}
    onChange={(e) => {
      void handlePincodeLookup(e.target.value);
    }}
    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none ${
      pincodeError
        ? 'border-red-400'
        : pincodeVerified
        ? 'border-green-500'
        : 'border-stone-300 focus:border-[#960018]'
    }`}
  />

  {pincodeLoading && (
    <p className="text-xs text-stone-500 mt-1">
      Verifying PIN code...
    </p>
  )}

  {pincodeError && (
    <p className="text-xs text-red-600 mt-1">
      {pincodeError}
    </p>
  )}

  {pincodeVerified && (
    <p className="text-xs text-green-600 mt-1">
      PIN code verified
    </p>
  )}
</div>

<div>
  <label className="block text-sm font-medium text-stone-900 mb-2">
    City
  </label>

  <input
    type="text"
    required
    value={addressForm.city}
    onChange={(e) =>
      handleAddressFormChange('city', e.target.value)
    }
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
    value={addressForm.district || ''}
    className="w-full px-4 py-2.5 border border-stone-300 rounded-lg bg-stone-100 text-stone-600 cursor-not-allowed"
  />
</div>

<div>
  <label className="block text-sm font-medium text-stone-900 mb-2">
    State
  </label>

  <input
    type="text"
    required
    readOnly
    value={addressForm.state}
    className="w-full px-4 py-2.5 border border-stone-300 rounded-lg bg-stone-100 text-stone-600 cursor-not-allowed"
  />
</div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-stone-900 mb-2">Country</label>
                        <input type="text" value="India" readOnly
  className="w-full px-4 py-2.5 border border-stone-300 rounded-lg bg-stone-100 text-stone-600 cursor-not-allowed"/>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-stone-900 mb-2">Landmark</label>
                        <input
                          type="text"
                          value={addressForm.landmark || ''}
                          onChange={(e) => handleAddressFormChange('landmark', e.target.value)}
                          className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:border-[#960018]"
                          placeholder="Near... (optional)"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addressForm.is_default}
                        onChange={(e) => handleAddressFormChange('is_default', e.target.checked)}
                        className="w-4 h-4 rounded border-stone-300 text-[#960018] focus:ring-[#960018]"
                      />
                      <span className="text-sm text-stone-700">Set as default address</span>
                    </label>

                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={savingAddress}
                        className="flex items-center gap-2 bg-[#960018] hover:bg-[#6F0012] disabled:bg-stone-400 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        {savingAddress ? 'Saving...' : editingAddressId ? 'Update Address' : 'Save Address'}
                      </button>
                      <button
                        type="button"
                        onClick={resetAddressForm}
                        className="px-6 py-2.5 border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-100 transition-colors font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* Address list / empty state */}
                {addressesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-[#960018]" />
                  </div>
                ) : addresses.length === 0 && !showAddressForm ? (
                  <div className="text-center py-12">
                    <MapPin className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                    <p className="text-stone-600 mb-4">No saved addresses yet</p>
                    <button
                      onClick={openAddAddressForm}
                      className="inline-flex items-center gap-2 bg-[#960018] hover:bg-[#6F0012] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      Add Address
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className={`relative border rounded-lg p-5 transition ${
                          addr.is_default
                            ? 'border-[#960018] bg-[#960018]/5'
                            : 'border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {addr.address_type && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 bg-stone-100 px-2 py-1 rounded">
                                <Home className="w-3 h-3" />
                                {addr.address_type}
                              </span>
                            )}
                            {addr.is_default && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#960018] bg-[#960018]/10 px-2 py-1 rounded">
                                <Star className="w-3 h-3 fill-[#960018] text-[#960018]" />
                                Default
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="font-semibold text-stone-900">{addr.full_name}</p>
                        <p className="text-sm text-stone-600 mt-1">{addr.phone}</p>
                        <div className="text-sm text-stone-600 mt-2 space-y-0.5">
                          <p>{addr.address_line_1}</p>
                          {addr.address_line_2 && <p>{addr.address_line_2}</p>}
                          <p>{addr.city}, {addr.state} - {addr.pincode}</p>
                          <p>{addr.country}</p>
                          {addr.landmark && <p className="text-stone-500">Landmark: {addr.landmark}</p>}
                        </div>

                        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-stone-100">
                          <button
                            onClick={() => openEditAddressForm(addr)}
                            className="flex items-center gap-1 text-sm text-stone-600 hover:text-[#960018] transition-colors font-medium"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteAddress(addr.id)}
                            className="flex items-center gap-1 text-sm text-stone-600 hover:text-red-600 transition-colors font-medium"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                          {!addr.is_default && (
                            <button
                              onClick={() => handleSetDefault(addr.id)}
                              className="flex items-center gap-1 text-sm text-stone-600 hover:text-[#960018] transition-colors font-medium ml-auto"
                            >
                              <Star className="w-3.5 h-3.5" />
                              Set Default
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Wishlist tab ── */}
            {activeTab === 'wishlist' && (
              <div className="bg-white rounded-lg shadow p-8">
                <h2 className="text-2xl font-bold text-stone-900 mb-6">My Wishlist</h2>
                {wishlistItems.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                    <p className="text-stone-600 mb-4">Your wishlist is empty</p>
                    <Link
                      to="/products"
                      className="inline-block bg-[#960018] hover:bg-[#6F0012] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                    >
                      Explore Products
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {wishlistItems.map((product) => (
                      <Link key={product.id} to={`/product/${product.id}`} className="group">
                        <div className="relative bg-stone-100 rounded-lg overflow-hidden aspect-square mb-3">
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        </div>
                        <h3 className="font-semibold text-stone-900 mb-1">{product.name}</h3>
                        <p className="text-[#960018] font-semibold">
                          ₹{product.price.toLocaleString()}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Orders tab ── */}
            {activeTab === 'orders' && (
              <div className="bg-white rounded-lg shadow p-8">
                <h2 className="text-2xl font-bold text-stone-900 mb-6">My Orders</h2>
                {ordersError && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-red-800 text-sm">{ordersError}</p>
                  </div>
                )}
                {ordersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-[#960018]" />
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                    <p className="text-stone-600 mb-4">No orders yet</p>
                    <Link
                      to="/products"
                      className="inline-block bg-[#960018] hover:bg-[#6F0012] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                    >
                      Start Shopping
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => {
                      const osDef = (order as any).order_status_def as OrderStatusDef | undefined;
                      return (
                        <Link
                          key={order.id}
                          to={`/account/orders/${order.id}`}
                          className="block border border-stone-200 rounded-lg p-4 hover:border-[#960018] hover:shadow-sm transition-all"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="font-mono text-sm text-stone-600">#{order.order_number}</p>
                              <p className="text-xs text-stone-500">{new Date(order.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              {osDef && osDef.show_to_customer && (
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${osDef.color}`}>
                                  {osDef.name}
                                </span>
                              )}
                              <span className="font-bold text-[#960018]">
                                ₹{(order.grand_total || 0).toLocaleString()}
                              </span>
                              <ChevronRight className="w-4 h-4 text-stone-400" />
                            </div>
                          </div>
                          <div className="space-y-1">
                            {((order as any).order_items?.length > 0
                              ? (order as any).order_items
                              : []
                            ).map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between text-sm text-stone-600">
                                <span>{item.product_name || item.name} x {item.quantity}</span>
                                <span>₹{((item.line_total ? Number(item.line_total) : item.price * item.quantity)).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                          {order.tracking_id && (
                            <div className="mt-3 pt-3 border-t border-stone-100">
                              <p className="text-xs text-stone-500">Tracking: <span className="font-mono text-stone-700">{order.tracking_id}</span></p>
                            </div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'coupons' && <MyCoupons />}
          </div>
        </div>
      </div>
    </div>
  );
}
