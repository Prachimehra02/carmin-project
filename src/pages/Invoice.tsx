import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Order } from '../types/order';
import html2pdf from 'html2pdf.js';
import carminLogo from '../assets/carmin_logo.png';

interface StoreTaxSettings {
  business_name: string | null;
  trade_name: string | null;
  gstin: string | null;

  registered_state_name: string | null;
  registered_state_code: string | null;

  address_line_1: string | null;
  address_line_2: string | null;
  landmark: string | null;
  locality: string | null;
  city: string | null;
  district: string | null;
  pincode: string | null;

  phone: string | null;
  email: string | null;
}

export default function Invoice() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [store, setStore] = useState<StoreTaxSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchInvoice = useCallback(async () => {
    if (!user || !orderId) return;

    try {
      setLoading(true);
      setError('');

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            order_id,
            product_id,
            product_name,
            product_sku,
            quantity,
            price,
            taxable_amount,
            tax_percentage,
            tax_amount,
            cgst_amount,
            sgst_amount,
            igst_amount,
            cess_amount,
            line_total,
            hsn_code,
            cgst_percentage,
            sgst_percentage,
            igst_percentage,
            cess_percentage
          )
        `)
        .eq('id', orderId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (orderError) throw orderError;

      if (!orderData) {
        throw new Error('Invoice not found.');
      }

      const { data: storeData, error: storeError } = await supabase
        .from('store_tax_settings')
        .select(`
          business_name,
          trade_name,
          gstin,
          registered_state_name,
          registered_state_code,
          address_line_1,
          address_line_2,
          landmark,
          locality,
          city,
          district,
          pincode,
          phone,
          email
        `)
        .eq('id', 1)
        .maybeSingle();

      if (storeError) throw storeError;

      setOrder(orderData as Order);
      setStore(storeData);
    } catch (err: any) {
      console.error('Invoice fetch error:', err);
      setError(err?.message || 'Unable to load invoice.');
    } finally {
      setLoading(false);
    }
  }, [user, orderId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  useEffect(() => {
  imageToBase64(carminLogo)
    .then(setPdfLogo)
    .catch((err) => {
      console.error('Logo conversion failed:', err);
    });
}, []);

  const money = (value?: number | null) =>
    Number(value || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatDate = (value?: string | null) => {
    if (!value) return '-';

    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const waitForImages = async (element: HTMLElement) => {
  const images = Array.from(element.querySelectorAll('img'));

  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }

          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );
};

  const imageToBase64 = (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Unable to create image canvas'));
        return;
      }

      ctx.drawImage(img, 0, 0);

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      reject(new Error('Unable to load logo'));
    };

    img.src = src;
  });
};

  const [pdfLogo, setPdfLogo] = useState<string>('');

  const handleDownload = async () => {
  const invoiceElement = document.getElementById('invoice');

  if (!invoiceElement || !order) return;
  const handleDownload = async () => {
  const invoiceElement = document.getElementById('invoice');

  if (!invoiceElement || !order) return;

  let logoData = pdfLogo;

  if (!logoData) {
    try {
      logoData = await imageToBase64(carminLogo);
      setPdfLogo(logoData);
    } catch (err) {
      console.error('Could not prepare invoice logo:', err);
    }
  }

  // Give React one frame to render the base64 image
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });

  const filename = order.invoice_number
    ? `${order.invoice_number.replace(/\//g, '-')}.pdf`
    : `${order.order_number}-invoice.pdf`;

  const options = {
    margin: 8,
    filename,

    image: {
      type: 'png' as const,
      quality: 1,
    },

    html2canvas: {
      scale: 4,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
    },

    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait' as const,
      compress: true,
    },

    pagebreak: {
      mode: ['css', 'legacy'],
    },
  };

  await html2pdf()
    .set(options)
    .from(invoiceElement)
    .save();
};

  const filename = order.invoice_number
    ? `${order.invoice_number.replace(/\//g, '-')}.pdf`
    : `${order.order_number}-invoice.pdf`;

  const options = {
  margin: 8,
  filename,
  image: {
    type: 'png' as const,
    quality: 1,
  },
  html2canvas: {
    scale: 4,
    useCORS: true,
    allowTaint: false,
    letterRendering: true,
    backgroundColor: '#ffffff',
  },
  jsPDF: {
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait' as const,
    compress: true,
  },
  pagebreak: {
    mode: ['css', 'legacy'],
  },
};

  await html2pdf()
    .set(options)
    .from(invoiceElement)
    .save();
};

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-stone-600">Loading invoice...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">
            {error || 'Invoice not found.'}
          </p>

          <button
            onClick={() => navigate(-1)}
            className="text-[#35165a] font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const address = order.shipping_address || {};

  const isIntraState =
    Number(order.cgst_amount || 0) > 0 ||
    Number(order.sgst_amount || 0) > 0;

  return (
    <div className="min-h-screen bg-stone-100 py-8 px-4 print:bg-white print:p-0">

      {/* Actions */}
      <div className="max-w-5xl mx-auto mb-5 flex items-center justify-between print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-stone-700 hover:text-[#35165a]"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <button
          onClick={handleDownload}
          className="flex items-center gap-2 bg-[#35165a] text-white px-5 py-2.5 rounded-lg hover:opacity-90"
        >
          <Download size={18} />
          Download Invoice
        </button>
      </div>

      {/* Invoice */}
<main
  id="invoice"
  className="max-w-5xl mx-auto bg-white text-black"
  style={{
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: '12px',
  }}
>
  {/* Header */}
  <div className="flex justify-between items-start px-7 pt-6 pb-5">
    <div className="w-[42%]">
      <img
        src={pdfLogo || carminLogo} alt="CARMIN SPACES" style={{height: '64px', width: 'auto', objectFit: 'contain', display: 'block', }}
      />
    </div>

    <div className="w-[58%] text-right">
      <h1 className="text-[18px] font-bold leading-tight">
        Tax Invoice
      </h1>

      <p className="text-[12px] mt-1">
        (Original for Recipient)
      </p>
    </div>
  </div>

  {/* Seller + Customer */}
  <div className="grid grid-cols-2 gap-8 px-7 py-4">

    {/* Seller */}
    <div>
      <p className="font-bold text-[13px] mb-1">
        Sold By:
      </p>

      <p className="font-semibold">
        {store?.trade_name || 'CARMIN SPACES'}
      </p>

      {store?.business_name && (
        <p>{store.business_name}</p>
      )}

      {store?.address_line_1 && (
        <p>{store.address_line_1}</p>
      )}

      {store?.address_line_2 && (
        <p>{store.address_line_2}</p>
      )}

      {store?.locality && (
        <p>{store.locality}</p>
      )}

      <p>
        {[store?.city, store?.district]
          .filter(Boolean)
          .join(', ')}
      </p>

      <p>
        {[store?.registered_state_name, store?.pincode]
          .filter(Boolean)
          .join(' - ')}
      </p>

      <div className="mt-4">
        <p>
          <span className="font-bold">GST Registration No: </span>
          {store?.gstin || '-'}
        </p>

        <p>
          <span className="font-bold">State/UT Code: </span>
          {store?.registered_state_code || '-'}
        </p>
      </div>
    </div>

    {/* Customer */}
    <div className="text-right">
      <p className="font-bold text-[13px] mb-1">
        Billing / Shipping Address:
      </p>

      <p className="font-semibold">
        {address.full_name || '-'}
      </p>

      {address.phone && <p>{address.phone}</p>}

      {address.address_line_1 && (
        <p>{address.address_line_1}</p>
      )}

      {address.address_line_2 && (
        <p>{address.address_line_2}</p>
      )}

      <p>
        {[address.city, address.district]
          .filter(Boolean)
          .join(', ')}
      </p>

      <p>
        {[address.state, address.pincode]
          .filter(Boolean)
          .join(' - ')}
      </p>

      <p className="mt-2">
        <span className="font-bold">State/UT Code: </span>
        {order.place_of_supply_state_code || '-'}
      </p>

      <p>
        <span className="font-bold">Place of Supply: </span>
        {order.place_of_supply_state || '-'}
      </p>
    </div>
  </div>

  {/* Order / Invoice Information */}
  <div className="grid grid-cols-2 gap-8 px-7 pt-5 pb-4">

    <div>
      <p>
        <span className="font-bold">Order Number: </span>
        {order.order_number}
      </p>

      <p>
        <span className="font-bold">Order Date: </span>
        {formatDate(order.created_at)}
      </p>

      <p>
        <span className="font-bold">Payment Method: </span>
        {(order.payment_method || 'COD').toUpperCase()}
      </p>
    </div>

    <div className="text-right">
      <p>
        <span className="font-bold">Invoice Number: </span>
        {order.invoice_number || '-'}
      </p>

      <p>
        <span className="font-bold">Invoice Date: </span>
        {formatDate(order.invoice_date)}
      </p>
    </div>
  </div>

  {/* Product Table */}
  <div className="px-7 mt-3">
    <table
      className="w-full border-collapse"
      style={{
        border: '1px solid #000',
        fontSize: '10px',
      }}
    >
      <thead>
        <tr>
          <th className="border border-black px-1.5 py-2 text-center w-[4%]">
            Sl.<br />No
          </th>

          <th className="border border-black px-2 py-2 text-left">
            Description
          </th>

          <th className="border border-black px-2 py-2 text-center">
            HSN
          </th>

          <th className="border border-black px-2 py-2 text-center">
            Qty
          </th>

          <th className="border border-black px-2 py-2 text-right">
            Unit Price
          </th>

          <th className="border border-black px-2 py-2 text-right">
            Taxable
          </th>

          <th className="border border-black px-2 py-2 text-center">
            Tax Rate
          </th>

          <th className="border border-black px-2 py-2 text-center">
            Tax Type
          </th>

          <th className="border border-black px-2 py-2 text-right">
            Tax Amount
          </th>

          <th className="border border-black px-2 py-2 text-right">
            Total
          </th>
        </tr>
      </thead>

      <tbody>
        {order.order_items?.map((item, index) => {
          const taxable = Number(
            item.taxable_amount || item.line_total || 0
          );

          const tax = Number(item.tax_amount || 0);

          const total = taxable + tax;

          const taxType = isIntraState
            ? 'CGST + SGST'
            : 'IGST';

          return (
            <tr key={item.id}>
              <td className="border border-black px-1.5 py-2 text-center align-top">
                {index + 1}
              </td>

              <td className="border border-black px-2 py-2 align-top">
                <p className="font-medium">
                  {item.product_name}
                </p>

                {item.product_sku && (
                  <p className="text-[9px] mt-1">
                    SKU: {item.product_sku}
                  </p>
                )}
              </td>

              <td className="border border-black px-2 py-2 text-center align-top">
                {item.hsn_code || '-'}
              </td>

              <td className="border border-black px-2 py-2 text-center align-top">
                {item.quantity}
              </td>

              <td className="border border-black px-2 py-2 text-right align-top whitespace-nowrap">
                ₹{money(item.price)}
              </td>

              <td className="border border-black px-2 py-2 text-right align-top whitespace-nowrap">
                ₹{money(taxable)}
              </td>

              <td className="border border-black px-2 py-2 text-center align-top">
                {Number(item.tax_percentage || 0)}%
              </td>

              <td className="border border-black px-2 py-2 text-center align-top">
                {taxType}
              </td>

              <td className="border border-black px-2 py-2 text-right align-top whitespace-nowrap">
                {isIntraState ? (
                  <>
                    <p>
                      CGST ₹{money(item.cgst_amount)}
                    </p>

                    <p>
                      SGST ₹{money(item.sgst_amount)}
                    </p>
                  </>
                ) : (
                  <>₹{money(item.igst_amount)}</>
                )}
              </td>

              <td className="border border-black px-2 py-2 text-right align-top font-semibold whitespace-nowrap">
                ₹{money(total)}
              </td>
            </tr>
          );
        })}

        {/* Totals */}
        <tr>
          <td
            colSpan={8}
            className="border border-black px-2 py-2 text-right font-bold"
          >
            TOTAL
          </td>

          <td className="border border-black px-2 py-2 text-right font-bold">
            ₹{money(order.tax_amount)}
          </td>

          <td className="border border-black px-2 py-2 text-right font-bold">
            ₹{money(order.grand_total)}
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  {/* Tax Summary */}
  <div className="px-7 mt-3">
    <table
      className="w-full border-collapse"
      style={{
        border: '1px solid #000',
        fontSize: '10px',
      }}
    >
      <tbody>
        <tr>
          <td className="border border-black px-2 py-1.5 font-semibold">
            Taxable Amount
          </td>

          <td className="border border-black px-2 py-1.5 text-right">
            ₹{money(order.taxable_amount)}
          </td>
        </tr>

        {Number(order.cgst_amount || 0) > 0 && (
          <tr>
            <td className="border border-black px-2 py-1.5">
              CGST
            </td>

            <td className="border border-black px-2 py-1.5 text-right">
              ₹{money(order.cgst_amount)}
            </td>
          </tr>
        )}

        {Number(order.sgst_amount || 0) > 0 && (
          <tr>
            <td className="border border-black px-2 py-1.5">
              SGST
            </td>

            <td className="border border-black px-2 py-1.5 text-right">
              ₹{money(order.sgst_amount)}
            </td>
          </tr>
        )}

        {Number(order.igst_amount || 0) > 0 && (
          <tr>
            <td className="border border-black px-2 py-1.5">
              IGST
            </td>

            <td className="border border-black px-2 py-1.5 text-right">
              ₹{money(order.igst_amount)}
            </td>
          </tr>
        )}

        {Number(order.shipping_charge || 0) > 0 && (
          <tr>
            <td className="border border-black px-2 py-1.5">
              Shipping Charges
            </td>

            <td className="border border-black px-2 py-1.5 text-right">
              ₹{money(order.shipping_charge)}
            </td>
          </tr>
        )}

        {Number(order.discount || 0) > 0 && (
          <tr>
            <td className="border border-black px-2 py-1.5">
              Discount
            </td>

            <td className="border border-black px-2 py-1.5 text-right">
              -₹{money(order.discount)}
            </td>
          </tr>
        )}

        <tr>
          <td className="border border-black px-2 py-2 font-bold text-[12px]">
            Grand Total
          </td>

          <td className="border border-black px-2 py-2 text-right font-bold text-[12px]">
            ₹{money(order.grand_total)}
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  {/* Amount in Words */}
  <div className="mx-7 border border-black border-t-0 px-2 py-2">
    <p className="font-bold">
      Amount in Words:
    </p>

    <p className="font-semibold mt-0.5">
      ₹{money(order.grand_total)}
    </p>
  </div>

  {/* Signatory */}
  <div className="mx-7 border border-black border-t-0 min-h-[105px]">
    <div className="flex justify-between h-full">
      <div className="p-2 flex flex-col justify-end">
        <p className="text-[10px]">
          Whether tax is payable under reverse charge: No
        </p>
      </div>

      <div className="w-[40%] p-3 text-right">
        <p className="font-bold">
          For CARMIN SPACES
        </p>

        <div className="h-12" />

        <p className="font-bold">
          Authorised Signatory
        </p>
      </div>
    </div>
  </div>

  {/* Footer */}
  <div className="px-7 py-4 text-center text-[9px]">
    <p>
      This is a computer-generated tax invoice.
    </p>

    <p className="mt-1">
      Thank you for shopping with CARMIN SPACES.
    </p>
  </div>
</main>

      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }

          body {
            background: white !important;
          }

          #invoice {
            width: 100%;
            max-width: none;
          }
        }
      `}</style>
    </div>
  );
}