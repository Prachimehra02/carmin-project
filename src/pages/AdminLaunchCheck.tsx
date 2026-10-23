import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { supabase } from '../lib/supabase';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  detail?: string;
}

export default function AdminLaunchCheck() {
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState(false);

  const runChecks = async () => {
    setRunning(true);
    setChecks([]);
    const results: CheckResult[] = [];

    // 1. Database connectivity
    try {
      const { error } = await supabase.from('products').select('id').limit(1);
      if (error) throw error;
      results.push({ name: 'Database Connectivity', status: 'pass', message: 'Supabase connection working' });
    } catch (err) {
      results.push({ name: 'Database Connectivity', status: 'fail', message: 'Cannot connect to Supabase', detail: String(err) });
    }

    // 2. Products count
    try {
      const { count, error } = await supabase.from('products').select('*', { count: 'exact', head: true });
      if (error) throw error;
      if (count && count > 0) {
        results.push({ name: 'Products Count', status: 'pass', message: `${count} products in database` });
      } else {
        results.push({ name: 'Products Count', status: 'fail', message: 'No products found in database' });
      }
    } catch (err) {
      results.push({ name: 'Products Count', status: 'fail', message: 'Failed to count products' });
    }

    // 3. Active products count
    try {
      const { count, error } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true);
      if (error) throw error;
      if (count && count > 0) {
        results.push({ name: 'Active Products', status: 'pass', message: `${count} active products` });
      } else {
        results.push({ name: 'Active Products', status: 'fail', message: 'No active products - storefront will be empty' });
      }
    } catch (err) {
      results.push({ name: 'Active Products', status: 'fail', message: 'Failed to check active products' });
    }

    // 4. Stock availability
    try {
      const { data, error } = await supabase.from('products').select('id, name, stock_quantity').eq('is_active', true);
      if (error) throw error;
      const products = data || [];
      const outOfStock = products.filter(p => p.stock_quantity === 0);
      const lowStock = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 5);
      if (outOfStock.length === products.length) {
        results.push({ name: 'Stock Availability', status: 'fail', message: 'All active products are out of stock' });
      } else if (outOfStock.length > 0) {
        results.push({
          name: 'Stock Availability',
          status: 'warn',
          message: `${outOfStock.length} out of stock, ${lowStock.length} low stock`,
          detail: outOfStock.map(p => p.name).join(', '),
        });
      } else if (lowStock.length > 0) {
        results.push({
          name: 'Stock Availability',
          status: 'warn',
          message: `${lowStock.length} products with low stock (1-5 units)`,
          detail: lowStock.map(p => p.name).join(', '),
        });
      } else {
        results.push({ name: 'Stock Availability', status: 'pass', message: 'All products have adequate stock' });
      }
    } catch (err) {
      results.push({ name: 'Stock Availability', status: 'fail', message: 'Failed to check stock' });
    }

    // 5. Products with images
    try {
      const { data, error } = await supabase.from('products').select('id, name, images').eq('is_active', true);
      if (error) throw error;
      const noImages = (data || []).filter(p => !p.images || p.images.length === 0);
      if (noImages.length > 0) {
        results.push({
          name: 'Product Images',
          status: 'warn',
          message: `${noImages.length} active products have no images`,
          detail: noImages.map(p => p.name).join(', '),
        });
      } else {
        results.push({ name: 'Product Images', status: 'pass', message: 'All active products have images' });
      }
    } catch (err) {
      results.push({ name: 'Product Images', status: 'fail', message: 'Failed to check product images' });
    }

    // 6. Products with slugs
    try {
      const { data, error } = await supabase.from('products').select('id, name, slug').eq('is_active', true);
      if (error) throw error;
      const noSlug = (data || []).filter(p => !p.slug);
      if (noSlug.length > 0) {
        results.push({
          name: 'Product Slugs',
          status: 'warn',
          message: `${noSlug.length} products missing SEO slugs`,
          detail: noSlug.map(p => p.name).join(', '),
        });
      } else {
        results.push({ name: 'Product Slugs', status: 'pass', message: 'All products have slugs' });
      }
    } catch (err) {
      results.push({ name: 'Product Slugs', status: 'fail', message: 'Failed to check slugs' });
    }

    // 7. Storage bucket access
    try {
      const { data, error } = await supabase.storage.from('products').list('product-images', { limit: 1 });
      if (error && error.message.includes('not found')) {
        results.push({ name: 'Storage Bucket', status: 'fail', message: 'Products bucket not found or not accessible' });
      } else if (error && error.message.includes('The resource was not found')) {
        results.push({ name: 'Storage Bucket', status: 'warn', message: 'Bucket exists but product-images folder not created yet (will auto-create on first upload)' });
      } else {
        results.push({ name: 'Storage Bucket', status: 'pass', message: 'Products storage bucket accessible' });
      }
    } catch (err) {
      results.push({ name: 'Storage Bucket', status: 'warn', message: 'Could not verify storage bucket access' });
    }

    // 8. Orders table
    try {
      const { count, error } = await supabase.from('orders').select('*', { count: 'exact', head: true });
      if (error) throw error;
      results.push({ name: 'Orders Table', status: 'pass', message: `Orders table accessible (${count || 0} orders)` });
    } catch (err) {
      results.push({ name: 'Orders Table', status: 'fail', message: 'Cannot access orders table' });
    }

    // 9. Coupons table
    try {
      const { count, error } = await supabase.from('coupons').select('*', { count: 'exact', head: true });
      if (error) throw error;
      results.push({ name: 'Coupons Table', status: 'pass', message: `Coupons table accessible (${count || 0} coupons)` });
    } catch (err) {
      results.push({ name: 'Coupons Table', status: 'fail', message: 'Cannot access coupons table' });
    }

    // 10. RLS check - verify tables are accessible with current auth context
    const allTablesAccessible = results.every(r => r.status !== 'fail' || !r.name.includes('Table'));
    if (allTablesAccessible) {
      results.push({ name: 'RLS Policies', status: 'pass', message: 'All tables accessible with current auth context' });
    } else {
      results.push({ name: 'RLS Policies', status: 'warn', message: 'Some tables may have RLS blocking access' });
    }

    setChecks(results);
    setRunning(false);
    setRan(true);
  };

  const passCount = checks.filter(c => c.status === 'pass').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const failCount = checks.filter(c => c.status === 'fail').length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Launch Verification</h2>
            <p className="text-gray-600 mt-1">Pre-flight checks for production readiness</p>
          </div>
          <button
            onClick={runChecks}
            disabled={running}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Running...' : ran ? 'Re-run Checks' : 'Run Checks'}
          </button>
        </div>

        {!ran && !running && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <p className="text-gray-600">Click "Run Checks" to verify your store is ready for launch</p>
          </div>
        )}

        {ran && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-700">{passCount}</p>
                <p className="text-sm text-green-600">Passed</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-amber-700">{warnCount}</p>
                <p className="text-sm text-amber-600">Warnings</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-red-700">{failCount}</p>
                <p className="text-sm text-red-600">Failed</p>
              </div>
            </div>

            {/* Results */}
            <div className="space-y-3">
              {checks.map((check) => (
                <div
                  key={check.name}
                  className={`bg-white rounded-lg shadow p-4 border-l-4 ${
                    check.status === 'pass' ? 'border-green-500' :
                    check.status === 'warn' ? 'border-amber-500' :
                    'border-red-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {check.status === 'pass' && <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />}
                    {check.status === 'warn' && <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />}
                    {check.status === 'fail' && <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />}
                    <div>
                      <h3 className="font-semibold text-gray-900">{check.name}</h3>
                      <p className={`text-sm ${
                        check.status === 'pass' ? 'text-green-700' :
                        check.status === 'warn' ? 'text-amber-700' :
                        'text-red-700'
                      }`}>
                        {check.message}
                      </p>
                      {check.detail && (
                        <p className="text-xs text-gray-500 mt-1">{check.detail}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Overall verdict */}
            <div className={`rounded-lg p-6 text-center ${
              failCount > 0 ? 'bg-red-50 border border-red-200' :
              warnCount > 0 ? 'bg-amber-50 border border-amber-200' :
              'bg-green-50 border border-green-200'
            }`}>
              {failCount > 0 ? (
                <>
                  <XCircle className="w-10 h-10 text-red-600 mx-auto mb-2" />
                  <h3 className="text-xl font-bold text-red-800">Not Ready for Launch</h3>
                  <p className="text-red-700">{failCount} critical issue{failCount > 1 ? 's' : ''} must be resolved</p>
                </>
              ) : warnCount > 0 ? (
                <>
                  <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto mb-2" />
                  <h3 className="text-xl font-bold text-amber-800">Mostly Ready</h3>
                  <p className="text-amber-700">{warnCount} warning{warnCount > 1 ? 's' : ''} to review before launch</p>
                </>
              ) : (
                <>
                  <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-2" />
                  <h3 className="text-xl font-bold text-green-800">Ready for Launch</h3>
                  <p className="text-green-700">All checks passed</p>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
