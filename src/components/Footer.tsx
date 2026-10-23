import {
  Instagram,
  Facebook,
  ArrowRight,
  ArrowUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { SiThreads } from "react-icons/si";

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <footer className="bg-[#F7F3EE] text-[#292334] border-t border-[#E5DED5]">
      {/* =====================================================
          MAIN FOOTER
      ===================================================== */}
      <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12">
        <div
          className="
            grid
            grid-cols-1
            md:grid-cols-2
            lg:grid-cols-12
            gap-10
            lg:gap-8
            py-12
            lg:py-8
          "
        >
          {/* =================================================
              BRAND
          ================================================= */}
          <div className="lg:col-span-3">
            <Link to="/" className="inline-block">
              <img
                src="/carmin_logo.png"
                alt="Carmin"
                className="h-12 lg:h-14 w-auto object-contain"
              />
            </Link>

            <p className="mt-3 text-[14px] leading-[1.55] text-[#625C66] max-w-[250px]">
              Thoughtfully curated home décor
              <br />
              for spaces that feel like you.
            </p>

            {/* Social Icons */}
            <div className="flex items-center gap-5 mt-5">
              {/* Instagram */}
              <a
                href="https://www.instagram.com/carminspaces"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-[#292334] hover:opacity-60 transition-opacity"
              >
                <Instagram className="w-[20px] h-[20px]" strokeWidth={1.7} />
              </a>

              {/* Pinterest */}
              <a
  href="https://in.pinterest.com/carminspaces"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Pinterest"
  className="text-[#292334] hover:opacity-60 transition-opacity"
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className="w-[26px] h-[26px]"
    fill="currentColor"
  >
    <path d="M12.04 2C6.53 2 3 5.95 3 10.47c0 3.42 1.92 6.45 4.99 7.58-.07-.65-.01-1.43.16-2.05l1.13-4.78s-.29-.58-.29-1.43c0-1.34.78-2.34 1.75-2.34.83 0 1.23.62 1.23 1.36 0 .83-.53 2.07-.8 3.22-.23.96.48 1.75 1.43 1.75 1.72 0 2.88-2.21 2.88-4.83 0-1.99-1.34-3.49-3.78-3.49-2.75 0-4.46 2.05-4.46 4.34 0 .79.23 1.35.6 1.84.17.2.19.28.13.51l-.2.79c-.07.25-.26.34-.48.25-1.32-.54-1.94-1.98-1.94-3.6 0-2.68 2.26-5.89 6.73-5.89 3.59 0 5.96 2.6 5.96 5.39 0 3.69-2.05 6.45-5.07 6.45-1.02 0-1.98-.55-2.31-1.17l-.66 2.61c-.2.77-.59 1.54-.95 2.14.85.25 1.74.38 2.66.38 5.51 0 9.04-3.95 9.04-8.47C21.08 5.95 17.55 2 12.04 2Z" />
  </svg>
</a>

              {/* Facebook */}
              <a
                href="https://www.facebook.com/profile.php?id=61578703986228"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="text-[#292334] hover:opacity-60 transition-opacity"
              >
                <Facebook className="w-[20px] h-[20px]" strokeWidth={1.7} />
              </a>

              {/* Threads */}
              <a href="https://www.threads.net/@carminspaces" target="_blank"
                rel="noopener noreferrer" aria-label="Threads"
                className="text-[#292334] hover:opacity-60 transition-opacity">
                <SiThreads className="w-[17px] h-[17px]"/>
              </a>
            </div>
          </div>

          {/* =================================================
              SHOP
          ================================================= */}
          <div className="lg:col-span-2">
            <h3
              className="
                text-[14px]
                tracking-[0.1em] font-semibold
                uppercase
                text-[#292334]
                mb-4
              "
            >
              Shop
            </h3>

            <ul className="space-y-[5px] text-[13px] text-[#625C66]">
              <li>
                <Link
                  to="/products"
                  className="hover:text-[#292334] transition-colors"
                >
                  All Products
                </Link>
              </li>

              <li>
                <Link
                  to="/products?new=true"
                  className="hover:text-[#292334] transition-colors"
                >
                  New Arrivals
                </Link>
              </li>

              <li>
                <Link
                  to="/products?category=decor-accessories"
                  className="hover:text-[#292334] transition-colors"
                >
                  Decor
                </Link>
              </li>

              <li>
                <Link
                  to="/products?category=vases"
                  className="hover:text-[#292334] transition-colors"
                >
                  Vases
                </Link>
              </li>

              <li>
                <Link
                  to="/products?category=pots-planters"
                  className="hover:text-[#292334] transition-colors"
                >
                  Pots & Planters
                </Link>
              </li>

              <li>
                <Link
                  to="/products"
                  className="hover:text-[#292334] transition-colors"
                >
                  Gifting
                </Link>
              </li>
            </ul>
          </div>

          {/* =================================================
              ABOUT
          ================================================= */}
          <div className="lg:col-span-2">
            <h3
              className="
                text-[14px]
                tracking-[0.1em] font-semibold
                uppercase
                text-[#292334]
                mb-4
              "
            >
              About
            </h3>

            <ul className="space-y-[5px] text-[13px] text-[#625C66]">
              <li>
                <Link
                  to="/about"
                  className="hover:text-[#292334] transition-colors"
                >
                  Our Story
                </Link>
              </li>

              <li>
                <Link
                  to="/"
                  className="hover:text-[#292334] transition-colors"
                >
                  The Carmin Edit
                </Link>
              </li>

              <li>
                <Link
                  to="/sustainability"
                  className="hover:text-[#292334] transition-colors"
                >
                  Sustainability
                </Link>
              </li>

              <li>
                <Link
                  to="/journal"
                  className="hover:text-[#292334] transition-colors"
                >
                  Journal
                </Link>
              </li>

              <li>
                <Link
                  to="/contact"
                  className="hover:text-[#292334] transition-colors"
                >
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* =================================================
              HELP
          ================================================= */}
          <div className="lg:col-span-2">
            <h3
              className="
                text-[14px]
                tracking-[0.1em] font-semibold
                uppercase
                text-[#292334]
                mb-4
              "
            >
              Help
            </h3>

            <ul className="space-y-[5px] text-[13px] text-[#625C66]">
              <li>
                <Link
                  to="/faq"
                  className="hover:text-[#292334] transition-colors"
                >
                  FAQs
                </Link>
              </li>

              <li>
                <Link
                  to="/shipping"
                  className="hover:text-[#292334] transition-colors"
                >
                  Shipping & Delivery
                </Link>
              </li>

              <li>
                <Link
                  to="/returns"
                  className="hover:text-[#292334] transition-colors"
                >
                  Returns & Refunds
                </Link>
              </li>

              <li>
                <Link
                  to="/care-guide"
                  className="hover:text-[#292334] transition-colors"
                >
                  Care Guide
                </Link>
              </li>

              <li>
                <Link
                  to="/track-order"
                  className="hover:text-[#292334] transition-colors"
                >
                  Track Your Order
                </Link>
              </li>
            </ul>
          </div>

          {/* =================================================
              NEWSLETTER
          ================================================= */}
          <div
            className="
              lg:col-span-3
              lg:border-l
              lg:border-[#D9D1C8]
              lg:pl-10
            "
          >
            <h3
              className="
                text-[14px]
                tracking-[0.1em] font-semibold
                uppercase
                text-[#292334]
                mb-4
              "
            >
              Stay in the Loop
            </h3>

            <p className="text-[13px] leading-[1.55] text-[#625C66] max-w-[290px] mb-3">
              Be the first to know about new arrivals,
              <br className="hidden lg:block" />
              exclusive offers and stories from Carmin.
            </p>

            {/* Newsletter Input */}
            <form
              onSubmit={(e) => e.preventDefault()}
              className="
                flex
                w-full
                max-w-[305px]
                border
                border-[#D7CEC4]
                bg-[#FBF9F6]
                rounded-[4px]
                overflow-hidden
              "
            >
              <input
                type="email"
                required
                placeholder="Enter your email address"
                className="
                  flex-1
                  min-w-0
                  bg-transparent
                  text-[#292334]
                  placeholder:text-[#8D8782]
                  px-3
                  py-2.5
                  text-[13px]
                  outline-none
                "
              />

              <button
                type="submit"
                aria-label="Subscribe"
                className="
                  w-10
                  shrink-0
                  flex
                  items-center
                  justify-center
                  text-[#292334]
                  hover:bg-[#EEE8E1]
                  transition-colors
                  border-l
                  border-[#D7CEC4]
                "
              >
                <ArrowRight
                  className="w-4 h-4"
                  strokeWidth={1.3}
                />
              </button>
            </form>

            {/* Checkbox */}
            <label className="flex items-center gap-2 mt-2.5 text-[12px] text-[#625C66]">
              <input
                type="checkbox"
                className="
                  w-3 h-3
                  accent-[#292334]
                "
              />

              <span>
                I agree to receive updates from Carmin.
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* =====================================================
          BOTTOM BAR
      ===================================================== */}
      <div className="border-t border-[#DDD5CC]">
        <div
          className="
            max-w-[1400px]
            mx-auto
            px-6
            sm:px-8
            lg:px-12
            py-3
            flex
            flex-col
            lg:flex-row
            items-center
            justify-between
            gap-4
          "
        >
          {/* Copyright */}
          <p className="text-[12px] text-[#625C66] order-1 lg:order-none">
            © {new Date().getFullYear()} Carmin. All rights reserved.
          </p>

          {/* Legal Links */}
          <div className="flex items-center gap-4 text-[12px] text-[#625C66]">
            <Link
              to="/privacy-policy"
              className="hover:text-[#292334] transition-colors"
            >
              Privacy Policy
            </Link>

            <span className="text-[#C9C1B8]">|</span>

            <Link
              to="/terms"
              className="hover:text-[#292334] transition-colors"
            >
              Terms of Service
            </Link>

            <span className="text-[#C9C1B8]">|</span>

            <Link
              to="/cookie-policy"
              className="hover:text-[#292334] transition-colors"
            >
              Cookie Policy
            </Link>
          </div>

          {/* Payment Methods + Back To Top */}
          <div className="flex items-center gap-5">
            {/* Payment Methods */}
            <div className="flex items-center gap-3 text-[#1F2940]">
              <span className="font-bold italic text-[14px]">
                VISA
              </span>

              {/* Mastercard */}
              <span className="flex items-center -space-x-1">
                <span className="w-4 h-4 rounded-full bg-[#E11D2E] opacity-90" />
                <span className="w-4 h-4 rounded-full bg-[#F59E0B] opacity-90" />
              </span>

              <span className="font-bold italic text-[13px]">
                RuPay
              </span>

              <span className="font-bold text-[13px]">
                UPI
              </span>
            </div>

            {/* Divider */}
            <div className="hidden sm:block h-6 w-px bg-[#CFC6BD]" />

            {/* Back To Top */}
            <button
              onClick={scrollToTop}
              className="
                flex
                items-center
                gap-3
                text-[12px]
                text-[#625C66]
                hover:text-[#292334]
                transition-colors
              "
            >
              <span
                className="
                  w-7
                  h-7
                  rounded-full
                  border
                  border-[#CFC6BD]
                  flex
                  items-center
                  justify-center
                  hover:bg-white
                  transition-colors
                "
              >
                <ArrowUp
                  className="w-3.5 h-3.5"
                  strokeWidth={1.3}
                />
              </span>

              <span className="hidden sm:block">
                Back to top
              </span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}