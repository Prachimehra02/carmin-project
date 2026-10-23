import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

interface ShippingAddress {
  full_name: string;
  phone: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  pincode: string;
}

interface OrderData {
  orderId: string;
  customerEmail: string;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shippingCharge: number;
  taxAmount?: number;
  grandTotal: number;
  shippingAddress: ShippingAddress;
  couponCode?: string;
  orderDate: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function sendEmailWithResend(
  to: string | string[],
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("EMAIL_FROM") || "orders@yourdomain.com",
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Resend API error:", errorData);
      return { success: false, error: JSON.stringify(errorData) };
    }

    return { success: true };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error: String(error) };
  }
}

function generateCustomerEmailHTML(order: OrderData): string {
  const itemsHTML = order.items
    .map(
      (item) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 8px; color: #374151;">${item.name}</td>
        <td style="padding: 12px 8px; color: #374151; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px 8px; color: #374151; text-align: right;">${formatCurrency(item.price)}</td>
      </tr>
    `
    )
    .join("");

  const addressHTML = `
    <p style="margin: 0; color: #374151;">${order.shippingAddress.full_name}</p>
    <p style="margin: 4px 0; color: #6b7280;">${order.shippingAddress.address_line_1}</p>
    ${order.shippingAddress.address_line_2 ? `<p style="margin: 4px 0; color: #6b7280;">${order.shippingAddress.address_line_2}</p>` : ""}
    <p style="margin: 4px 0; color: #6b7280;">${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.pincode}</p>
    <p style="margin: 4px 0; color: #6b7280;">Phone: ${order.shippingAddress.phone}</p>
  `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8fafc; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
    <h1 style="font-size: 28px; font-weight: 700; color: #1f2937; margin: 0 0 8px 0;">Order Confirmed</h1>
    <p style="font-size: 16px; color: #6b7280; margin: 0 0 24px 0;">Thank you for shopping with us!</p>

    <div style="background-color: white; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #e5e7eb;">
      <table style="width: 100%; margin-bottom: 16px;">
        <tr>
          <td style="color: #6b7280; font-size: 14px;">Order ID</td>
          <td style="color: #1f2937; font-weight: 600; text-align: right; font-size: 14px;">#${order.orderId}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; font-size: 14px; padding-top: 8px;">Order Date</td>
          <td style="color: #1f2937; text-align: right; font-size: 14px; padding-top: 8px;">${formatDate(order.orderDate)}</td>
        </tr>
      </table>
    </div>

    <h2 style="font-size: 18px; font-weight: 600; color: #1f2937; margin: 0 0 12px 0;">Order Summary</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 12px 8px; text-align: left; font-size: 14px; color: #374151;">Product</th>
          <th style="padding: 12px 8px; text-align: center; font-size: 14px; color: #374151;">Qty</th>
          <th style="padding: 12px 8px; text-align: right; font-size: 14px; color: #374151;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>

    <div style="background-color: white; border-radius: 8px; padding: 16px; border: 1px solid #e5e7eb;">
      <table style="width: 100%;">
        <tr>
          <td style="color: #6b7280; font-size: 14px;">Subtotal</td>
          <td style="text-align: right; font-size: 14px; color: #374151;">${formatCurrency(order.subtotal)}</td>
        </tr>
        ${order.discount > 0 ? `
        <tr>
          <td style="color: #059669; font-size: 14px;">Discount ${order.couponCode ? `(${order.couponCode})` : ""}</td>
          <td style="text-align: right; font-size: 14px; color: #059669;">-${formatCurrency(order.discount)}</td>
        </tr>
        ` : ""}
        <tr>
          <td style="color: #6b7280; font-size: 14px; padding-top: 8px;">Shipping</td>
          <td style="text-align: right; font-size: 14px; padding-top: 8px; color: #374151;">${order.shippingCharge > 0 ? formatCurrency(order.shippingCharge) : "Free"}</td>
        </tr>
        ${order.taxAmount && order.taxAmount > 0 ? `
        <tr>
          <td style="color: #6b7280; font-size: 14px; padding-top: 8px;">Taxes</td>
          <td style="text-align: right; font-size: 14px; padding-top: 8px; color: #374151;">${formatCurrency(order.taxAmount)}</td>
        </tr>
        ` : ""}
        <tr style="border-top: 2px solid #1f2937;">
          <td style="font-weight: 700; color: #1f2937; font-size: 16px; padding-top: 12px;">Total</td>
          <td style="font-weight: 700; text-align: right; color: #1f2937; font-size: 16px; padding-top: 12px;">${formatCurrency(order.grandTotal)}</td>
        </tr>
      </table>
    </div>

    <h2 style="font-size: 18px; font-weight: 600; color: #1f2937; margin: 24px 0 12px 0;">Shipping Address</h2>
    <div style="background-color: white; border-radius: 8px; padding: 16px; border: 1px solid #e5e7eb;">
      ${addressHTML}
    </div>

    <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-top: 24px; border: 1px solid #fcd34d;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">
        <strong>Thank you for your order!</strong> Our team will contact you shortly to confirm the order and arrange payment/shipping.
      </p>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 24px; text-align: center;">
      If you have any questions, please contact us at <a href="mailto:${Deno.env.get("EMAIL_FROM") || "support@yourdomain.com"}" style="color: #2563eb;">${Deno.env.get("EMAIL_FROM") || "support@yourdomain.com"}</a>
    </p>
  </div>
</body>
</html>
  `;
}

function generateAdminEmailHTML(order: OrderData): string {
  const itemsHTML = order.items
    .map(
      (item) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 8px; color: #374151;">${item.name}</td>
        <td style="padding: 12px 8px; color: #374151; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px 8px; color: #374151; text-align: right;">${formatCurrency(item.price)}</td>
      </tr>
    `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #1f2937; border-radius: 12px; padding: 32px;">
    <h1 style="font-size: 24px; font-weight: 700; color: white; margin: 0 0 8px 0;">New Order Received</h1>
    <p style="font-size: 16px; color: #9ca3af; margin: 0 0 24px 0;">Order ID: <span style="color: #fbbf24; font-weight: 600;">#${order.orderId}</span></p>

    <div style="background-color: white; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
      <h3 style="font-size: 14px; font-weight: 600; color: #6b7280; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.05em;">Customer Details</h3>
      <table style="width: 100%;">
        <tr>
          <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Name</td>
          <td style="color: #1f2937; font-weight: 600; text-align: right; font-size: 14px; padding: 4px 0;">${order.customerName}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Email</td>
          <td style="color: #1f2937; text-align: right; font-size: 14px; padding: 4px 0;">${order.customerEmail}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Phone</td>
          <td style="color: #1f2937; text-align: right; font-size: 14px; padding: 4px 0;">${order.shippingAddress.phone}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Order Date</td>
          <td style="color: #1f2937; text-align: right; font-size: 14px; padding: 4px 0;">${formatDate(order.orderDate)}</td>
        </tr>
      </table>
    </div>

    <h3 style="font-size: 14px; font-weight: 600; color: white; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.05em;">Order Summary</h3>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; background-color: white; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 12px 8px; text-align: left; font-size: 14px; color: #374151;">Product</th>
          <th style="padding: 12px 8px; text-align: center; font-size: 14px; color: #374151;">Qty</th>
          <th style="padding: 12px 8px; text-align: right; font-size: 14px; color: #374151;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>

    <div style="background-color: white; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <table style="width: 100%;">
        <tr>
          <td style="color: #6b7280; font-size: 14px;">Subtotal</td>
          <td style="text-align: right; font-size: 14px; color: #374151;">${formatCurrency(order.subtotal)}</td>
        </tr>
        ${order.discount > 0 ? `
        <tr>
          <td style="color: #059669; font-size: 14px;">Discount ${order.couponCode ? `(${order.couponCode})` : ""}</td>
          <td style="text-align: right; font-size: 14px; color: #059669;">-${formatCurrency(order.discount)}</td>
        </tr>
        ` : ""}
        <tr>
          <td style="color: #6b7280; font-size: 14px; padding-top: 8px;">Shipping</td>
          <td style="text-align: right; font-size: 14px; padding-top: 8px; color: #374151;">${order.shippingCharge > 0 ? formatCurrency(order.shippingCharge) : "Free"}</td>
        </tr>
        ${order.taxAmount && order.taxAmount > 0 ? `
        <tr>
          <td style="color: #6b7280; font-size: 14px; padding-top: 8px;">Taxes</td>
          <td style="text-align: right; font-size: 14px; padding-top: 8px; color: #374151;">${formatCurrency(order.taxAmount)}</td>
        </tr>
        ` : ""}
        <tr style="border-top: 2px solid #1f2937;">
          <td style="font-weight: 700; color: #1f2937; font-size: 16px; padding-top: 12px;">Total</td>
          <td style="font-weight: 700; text-align: right; color: #1f2937; font-size: 16px; padding-top: 12px;">${formatCurrency(order.grandTotal)}</td>
        </tr>
      </table>
    </div>

    <div style="background-color: white; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <h3 style="font-size: 14px; font-weight: 600; color: #6b7280; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.05em;">Shipping Address</h3>
      <p style="margin: 0; color: #1f2937; font-weight: 600;">${order.shippingAddress.full_name}</p>
      <p style="margin: 4px 0; color: #374151;">${order.shippingAddress.address_line_1}</p>
      ${order.shippingAddress.address_line_2 ? `<p style="margin: 4px 0; color: #374151;">${order.shippingAddress.address_line_2}</p>` : ""}
      <p style="margin: 4px 0; color: #374151;">${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.pincode}</p>
      <p style="margin: 4px 0; color: #374151;">Phone: ${order.shippingAddress.phone}</p>
    </div>

    ${order.couponCode ? `
    <div style="background-color: #dcfce7; border-radius: 8px; padding: 12px; border: 1px solid #86efac;">
      <p style="margin: 0; color: #166534; font-size: 14px;"><strong>Coupon Used:</strong> ${order.couponCode}</p>
    </div>
    ` : ""}
  </div>
</body>
</html>
  `;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const orderData: OrderData = await req.json();

    if (!orderData.orderId || !orderData.customerEmail || !orderData.items?.length) {
      return new Response(JSON.stringify({ error: "Missing required order data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminEmail = Deno.env.get("ADMIN_EMAIL");
    const storeName = Deno.env.get("STORE_NAME") || "Our Store";

    console.log(`Sending order confirmation emails for order ${orderData.orderId}`);

    const customerSubject = `Order Confirmation - #${orderData.orderId}`;
    const adminSubject = `New Order Received - #${orderData.orderId}`;

    const customerHTML = generateCustomerEmailHTML(orderData);
    const adminHTML = generateAdminEmailHTML(orderData);

    const emailPromises: Promise<{ success: boolean; error?: string }>[] = [];

    // Send to customer
    emailPromises.push(
      sendEmailWithResend(orderData.customerEmail, customerSubject, customerHTML)
        .then(result => {
          if (result.success) {
            console.log(`Customer email sent to ${orderData.customerEmail}`);
          } else {
            console.error(`Failed to send customer email: ${result.error}`);
          }
          return result;
        })
    );

    // Send to admin
    if (adminEmail) {
      emailPromises.push(
        sendEmailWithResend(adminEmail, adminSubject, adminHTML)
          .then(result => {
            if (result.success) {
              console.log(`Admin email sent to ${adminEmail}`);
            } else {
              console.error(`Failed to send admin email: ${result.error}`);
            }
            return result;
          })
      );
    } else {
      console.warn("ADMIN_EMAIL not configured - skipping admin notification");
    }

    const results = await Promise.all(emailPromises);

    const customerResult = results[0];
    if (!customerResult.success) {
      console.error(`Customer email failed for order ${orderData.orderId}: ${customerResult.error}`);
    }

    const adminResult = results[1];
    if (adminEmail && adminResult && !adminResult.success) {
      console.error(`Admin email failed for order ${orderData.orderId}: ${adminResult.error}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Order emails processed",
      customerEmailSent: customerResult.success,
      adminEmailSent: adminResult ? adminResult.success : null,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error processing order emails:", error);
    return new Response(JSON.stringify({
      success: false,
      error: "Internal server error",
      details: String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
