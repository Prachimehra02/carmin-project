import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';

export default function LoginOTP() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const navigate = useNavigate();
  const { signInWithOTP, verifyOTP } = useAuth();

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithOTP(email);
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await verifyOTP(email, otp);
      navigate('/products');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 flex items-top justify-center px-4 py-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        {otpSent && (
          <button
            onClick={() => {
              setOtpSent(false);
              setOtp('');
              setError('');
            }}
            className="inline-flex items-center gap-2 text-[#960018] hover:text-[#6F0012] font-medium mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}

        <h1 className="text-3xl font-bold text-stone-900 mb-2">
          {otpSent ? 'Enter OTP' : 'Sign In with OTP'}
        </h1>
        <p className="text-stone-600 mb-8">
          {otpSent
            ? 'Enter the one-time password sent to your email'
            : 'Get a secure sign-in code sent to your email'}
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {otpSent ? (
          <form onSubmit={handleVerifyOTP} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-stone-900 mb-2">One-Time Password</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                required
                placeholder="000000"
                className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:border-[#960018] focus:ring-2 focus:ring-[#960018]/10 text-center text-2xl tracking-widest font-mono"
              />
              <p className="text-xs text-stone-500 mt-2">Check your email for the code</p>
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full bg-[#960018] hover:bg-[#6F0012] disabled:bg-stone-400 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSendOTP} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-stone-900 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 w-5 h-5 text-stone-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:border-[#960018] focus:ring-2 focus:ring-[#960018]/10"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#960018] hover:bg-[#6F0012] disabled:bg-stone-400 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        )}

        <div className="mt-6 space-y-3 text-center">
          <p className="text-stone-600 text-sm">
            Prefer password login?{' '}
            <Link to="/login" className="text-[#960018] hover:text-[#6F0012] font-semibold">
              Sign in instead
            </Link>
          </p>
          <p className="text-stone-600 text-sm">
            Don't have an account?{' '}
            <Link to="/signup" className="text-[#960018] hover:text-[#6F0012] font-semibold">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
