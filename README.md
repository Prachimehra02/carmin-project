# Carmin - E-Commerce Platform

A modern e-commerce platform for home decor and planters built with React, TypeScript, Tailwind CSS, and Supabase.

## Features

- Product catalog with categories (Planters, Vases, Decor, etc.)
- Shopping cart with persistent storage
- Wishlist synced across devices
- User authentication (email/password)
- Admin dashboard for product and order management
- Discount coupons system
- Order email notifications

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Email**: Resend API

## Email Notifications Setup

Order confirmation emails are sent automatically after successful order placement via the `send-order-emails` Edge Function.

### Prerequisites

1. A [Resend](https://resend.com) account
2. A verified sender domain in Resend
3. Supabase Edge Functions enabled

### Configuration

Set the following secrets in your Supabase Edge Function environment:

```bash
# Using Supabase CLI
supabase secrets set RESEND_API_KEY=re_xxxx_your_api_key
supabase secrets set EMAIL_FROM=noreply@yourdomain.com
supabase secrets set ADMIN_EMAIL=admin@yourdomain.com
supabase secrets set STORE_NAME=Carmin
```

Or via the Supabase Dashboard:
1. Go to **Edge Functions** > **send-order-emails**
2. Click **Settings** > **Secrets**
3. Add the following:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `RESEND_API_KEY` | Your Resend API key | `re_xxxxxxxxx` |
| `EMAIL_FROM` | Sender email address (must be verified in Resend) | `orders@yourdomain.com` |
| `ADMIN_EMAIL` | Email to receive new order notifications | `admin@yourdomain.com` |
| `STORE_NAME` | Your store name (optional) | `Carmin` |

### Email Templates

#### Customer Email
- Order confirmation with order ID
- Product list with quantities and prices
- Shipping address
- Total breakdown (subtotal, discount, shipping, grand total)
- Thank you message

#### Admin Email
- New order notification
- Customer details (name, email, phone)
- Full order summary
- Coupon code (if used)
- Shipping address

### Error Handling

If email sending fails:
- The order is still created successfully
- Error is logged to Edge Function logs
- Customer is redirected to order confirmation page
- No user-facing impact

### Testing

To test email notifications:

1. Place a test order on the checkout page
2. Check Supabase Edge Function logs for delivery status
3. Verify emails in your Resend dashboard

```bash
# View Edge Function logs
supabase functions logs send-order-emails
```

## Admin Setup

### Creating an Admin User

1. Sign up with the admin email through the normal registration flow
2. Insert into the `admin_users` table:

```sql
INSERT INTO admin_users (user_id)
SELECT id FROM auth.users WHERE email = 'admin@yourdomain.com';
```

### Admin Features

- **Products**: Create, edit, delete products; manage inventory and pricing
- **Orders**: View all orders; update order status; add tracking numbers
- **Coupons**: Create and manage discount codes
- **Launch Check**: Verify store readiness before going live

## Database Schema

### Core Tables
- `products` - Product catalog with SEO, inventory, and pricing fields
- `orders` - Customer orders with address and payment info
- `order_items` - Line items for each order
- `addresses` - Saved customer addresses
- `wishlist` - User wishlists synced across devices
- `coupons` - Discount codes with expiry and usage rules
- `admin_users` - Admin role management

### Authentication
- Row Level Security (RLS) enabled on all tables
- User-scoped policies for personal data (orders, wishlist, addresses)
- Admin-scoped policies for management operations

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Type check
npm run typecheck
```

## Environment Variables

Required in `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Production Checklist

See `/admin/launch-check` in the admin dashboard for automated verification of:

- Database connectivity
- Active products count
- Stock availability
- Storage bucket access
- RLS policies
- Coupon management

## License

Private - All rights reserved
