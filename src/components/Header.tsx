import {
  ShoppingCart,
  Search,
  Menu,
  User,
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

import {
  getActiveCategories,
  getCategoryUrl, 
  type Category,
} from "../services/categoryService";
import { useEffect, useRef, useState } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import SearchBar from "./SearchBar";
import CartDrawer from "./CartDrawer";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";


type CategoryNavProps = {
  categories: Category[];
};

type DesktopNavigationProps = CategoryNavProps & {
  transparent?: boolean;
  onMenuOpenChange?: (isOpen: boolean) => void;
};


function FloatingSubcategoryMenu({
  parentId,
  categories,
  depth = 0,
}: {
  parentId: number;
  categories: Category[];
  depth?: number;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
const [openLeft, setOpenLeft] = useState(false);

useEffect(() => {
  const updatePosition = () => {
    const menu = menuRef.current;
    if (!menu) return;

    const parent = menu.parentElement;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();
    const menuWidth = menu.offsetWidth;
    const viewportWidth = window.innerWidth;
    const edgeGap = 12;

    const spaceRight = viewportWidth - parentRect.right;
    const spaceLeft = parentRect.left;

    if (spaceRight >= menuWidth + edgeGap) {
      setOpenLeft(false);
    } else if (spaceLeft >= menuWidth + edgeGap) {
      setOpenLeft(true);
    } else {
      setOpenLeft(spaceLeft > spaceRight);
    }
  };

  updatePosition();

  window.addEventListener("resize", updatePosition);

  return () => {
    window.removeEventListener("resize", updatePosition);
  };
}, [parentId]);

if (depth > 20) return null;

const parentCategory = categories.find(
  item => item.id === parentId
);

  const children = categories.filter(
    item => item.parent_id === parentId
  );

  if (children.length === 0) return null;

  return (
    <div
    ref={menuRef}
    className={`
      absolute top-0 z-[130]
      ${openLeft ? "right-full" : "left-full"}
        w-[220px] bg-[#FFFCF9]
        border border-stone-200/80
        rounded-lg shadow-xl
        p-2

        opacity-0 invisible pointer-events-none
        group-hover/subitem:opacity-100
        group-hover/subitem:visible
        group-hover/subitem:pointer-events-auto
        group-focus-within/subitem:opacity-100
        group-focus-within/subitem:visible
        group-focus-within/subitem:pointer-events-auto
        transition-opacity duration-150
      `}
    >
      {parentCategory && (
        <p
          className="
            px-1 pt-1 pb-1
            text-[14px] tracking-[0.03em]
            font-medium  hover:text-[#960018] text-[#2B1F3D]
          "
        >
          {parentCategory.name}
        </p>
      )}

      <div className="space-y-0">
        {children.map(child => {
          const hasChildren = categories.some(
            item => item.parent_id === child.id
          );

          return (
            <div
              key={child.id}
              className="relative group/subitem"
            >
              <Link
                to={getCategoryUrl(child, categories)}
                className="
                  flex items-center justify-between
                  gap-3 px-3 py-1 rounded-md
                  text-sm text-[#736B78]
                  hover:bg-[#FBE9E9]
                  hover:text-[#960018]
                  transition-colors
                "
              >
                <span>{child.name}</span>

                {hasChildren && (
                  <ChevronRight
                    className="w-4 h-4 shrink-0"
                  />
                )}
              </Link>

              {hasChildren && (
                <FloatingSubcategoryMenu
                  parentId={child.id}
                  categories={categories}
                  depth={depth + 1}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DesktopMegaMenu({
  category,
  categories,
}: {
  category: Category;
  categories: Category[];
}) {
  const [startIndex, setStartIndex] = useState(0);

const gridContainerRef = useRef<HTMLDivElement>(null);

const [visibleCount, setVisibleCount] = useState(4);

useEffect(() => {
  const container = gridContainerRef.current;
  if (!container) return;

  const CARD_MIN_WIDTH = 190;
  const GAP = 12;

  const updateVisibleCount = () => {
    const availableWidth = container.clientWidth;

    if (availableWidth <= 0) return;

    const count = Math.max(
      1,
      Math.floor(
        (availableWidth + GAP) /
        (CARD_MIN_WIDTH + GAP)
      )
    );

    setVisibleCount(count);
  };

  const observer = new ResizeObserver(updateVisibleCount);

  observer.observe(container);
  updateVisibleCount();

  return () => observer.disconnect();
}, []);

useEffect(() => {
  setStartIndex(0);
}, [category.id]);
  const children = categories.filter(
    item => item.parent_id === category.id
  );

  const categoryUrl = getCategoryUrl(category, categories);
  const maxStartIndex = Math.max(0, children.length - visibleCount);

const currentStartIndex = Math.min(startIndex, maxStartIndex);

const visibleCategories = children.slice(
  currentStartIndex,
  currentStartIndex + visibleCount
);

const showArrows = children.length > visibleCount;

const canGoLeft = currentStartIndex > 0;
const canGoRight = currentStartIndex < maxStartIndex;

const moveLeft = () => {
  setStartIndex(prev => Math.max(0, prev - 1));
};

const moveRight = () => {
  setStartIndex(prev => Math.min(maxStartIndex, prev + 1));
};

  return (
    <div
      className="w-full bg-[#FFFCF9] rounded-b-2xl shadow-2xl
    border border-stone-100 px-4 py-4">
      {/* Mega menu heading */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#960018] mb-0">
              Explore {category.name}
            </p>

            <h2 className="font-[Manrope] text-3xl font-normal tracking-[-0.025em] text-[#2B1F3D]">
              {category.name}
            </h2>
          </div>

          {category.description && (
            <p className="text-sm text-[#62596B] max-w-sm border-l border-stone-300 pl-8 leading-relaxed">
              {category.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-5">
  <Link
    to={categoryUrl}
    className="text-sm font-medium text-[#960018] hover:underline"
  >
    View All {category.name} →
  </Link>

  {showArrows && (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={moveLeft}
        disabled={!canGoLeft}
        aria-label="Previous categories"
        className="
          w-9 h-9 rounded-full
          border border-[#960018]/30
          flex items-center justify-center
          text-[#960018]
          hover:bg-[#960018] hover:text-white
          disabled:opacity-30
          disabled:cursor-not-allowed
          disabled:hover:bg-transparent
          disabled:hover:text-[#960018]
          transition-colors
        "
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={moveRight}
        disabled={!canGoRight}
        aria-label="Next categories"
        className="
          w-9 h-9 rounded-full
          border border-[#960018]/30
          flex items-center justify-center
          text-[#960018]
          hover:bg-[#960018] hover:text-white
          disabled:opacity-30
          disabled:cursor-not-allowed
          disabled:hover:bg-transparent
          disabled:hover:text-[#960018]
          transition-colors
        "
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )}
</div>
      </div>

      {/* Category image grid */}
      <div ref={gridContainerRef} className="w-full min-w-0">
  <div
    className="grid gap-3"
    style={{
      gridTemplateColumns: `repeat(${Math.max(
        1,
        Math.min(visibleCount, visibleCategories.length)
      )}, minmax(0, 1fr))`,
    }}
  >
        {visibleCategories.map(child => {
          const subcategories = categories.filter(
            item => item.parent_id === child.id
          );

          return (
            <div key={child.id} className="min-w-0">
              <Link to={getCategoryUrl(child, categories)}>
                {child.image_url ? (
                  <img
                    src={child.image_url}
                    alt={child.name}
                    className="w-full h-40 object-cover rounded-sm"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-40 bg-stone-100 rounded-sm" />
                )}

                <h3 className="font-medium tracking-[0.03em] text-[#2B1F3D] ml-2 mt-3 mb-1 hover:text-[#960018]">
                  {child.name}
                </h3>
              </Link>

              <div className="space-y-1 border-l border-stone-200 pl-2">
  {subcategories.map(subcategory => {
    const hasChildren = categories.some(
      item => item.parent_id === subcategory.id
    );

    return (
      <div
        key={subcategory.id}
        className="relative group/subitem"
      >
        <Link
          to={getCategoryUrl(subcategory, categories)}
          className="
            flex items-center justify-between
            gap-2 px-2 pb-1 rounded-md
            text-sm text-[#736B78]
            hover:bg-[#FBE9E9]
            hover:text-[#960018]
            transition-colors
          "
        >
          <span>{subcategory.name}</span>

          {hasChildren && (
            <ChevronRight className="w-4 h-4 shrink-0" />
          )}
        </Link>

        {hasChildren && (
          <FloatingSubcategoryMenu
            parentId={subcategory.id}
            categories={categories}
          />
        )}
      </div>
    );
  })}
</div>
            </div>
          );
        })}
    </div>
      </div>
    </div>
  );
}

function DesktopNavigation({
  categories,
  transparent = false,
  onMenuOpenChange,
}: DesktopNavigationProps) {
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
const location = useLocation();

const navRef = useRef<HTMLElement>(null);
const triggerRefs = useRef<Record<number, HTMLAnchorElement | null>>({});

const closeMegaMenu = () => {
  setActiveCategory(null);
};

const handleNavKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
  if (event.key !== "Escape") return;
  if (activeCategory === null) return;

  event.preventDefault();
  event.stopPropagation();

  const categoryId = activeCategory;
  closeMegaMenu();
  triggerRefs.current[categoryId]?.focus();
};

const handleNavBlur = (event: React.FocusEvent<HTMLElement>) => {
  const nextElement = event.relatedTarget as Node | null;

  if (!nextElement || !navRef.current?.contains(nextElement)) {
    closeMegaMenu();
  }
};

useEffect(() => {
  setActiveCategory(null);
}, [location.pathname]);

  const rootCategories = categories.filter(
    category => category.parent_id === null
  );

  const selectedCategory = rootCategories.find(
    category => category.id === activeCategory
  );
  useEffect(() => {
  onMenuOpenChange?.(Boolean(selectedCategory));
}, [selectedCategory, onMenuOpenChange]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-base font-medium tracking-[0.03em] transition-colors duration-300 ${
      isActive
        ? "text-[#960018]"
        : transparent
          ? "text-white/95 hover:text-[#960018]"
          : "text-[#2B1F3D] hover:text-[#960018]"
    }`;

  return (
    <div ref={navRef}
  className="hidden lg:flex flex-1 justify-center"
  onKeyDown={handleNavKeyDown}
  onBlur={handleNavBlur}>
      <nav className="flex items-center gap-6 xl:gap-10 whitespace-nowrap">
        <NavLink
          to="/products"
          end
          className={linkClass}
          onMouseEnter={() => setActiveCategory(null)}
        >
          Shop All
        </NavLink>

        <NavLink
          to="/new-arrivals"
          className={linkClass}
          onMouseEnter={() => setActiveCategory(null)}
        >
          New Arrivals
        </NavLink>

        {rootCategories.map(category => {
          const hasChildren = categories.some(
            item => item.parent_id === category.id
          );

          return (
            <NavLink
              key={category.id}
  ref={(element) => {
    triggerRefs.current[category.id] = element;
  }}
  to={getCategoryUrl(category, categories)}
  aria-haspopup={hasChildren ? "true" : undefined}
  aria-expanded={hasChildren ? activeCategory === category.id : undefined}
  onMouseEnter={() =>
    setActiveCategory(hasChildren ? category.id : null)
  }
  onKeyDown={(event) => {
    if (!hasChildren) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveCategory(category.id);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeMegaMenu();
      event.currentTarget.focus();
    }
  }}
              className={({ isActive }) =>
                `text-base font-medium tracking-[0.03em] transition-colors duration-300 ${
                  activeCategory === category.id || isActive
                    ? "text-[#960018]"
                    : transparent
                      ? "text-white/95 hover:text-[#960018]"
                      : "text-[#2B1F3D] hover:text-[#960018]"
                }`
              }
            >
              {category.name}
            </NavLink>
          );
        })}

        <NavLink
          to="/gifting"
          className={linkClass}
          onMouseEnter={() => setActiveCategory(null)}
        >
          Gifting
        </NavLink>
      </nav>

      {selectedCategory && (
  <div
    onMouseLeave={(event) => {
      if (!event.currentTarget.contains(document.activeElement)) {
        closeMegaMenu();
      }
    }}
    className="absolute top-full left-0 right-0 z-[110]"
  >
    <DesktopMegaMenu
      category={selectedCategory}
      categories={categories}
    />
  </div>
)}
    </div>
  );
}

function MobileCategoryItem({
  category,
  categories,
  depth = 0,
}: {
  category: Category;
  categories: Category[];
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  if (depth > 20) return null;

  const children = categories.filter(
    item => item.parent_id === category.id
  );

  const hasChildren = children.length > 0;
  const url = getCategoryUrl(category, categories);

  return (
    <div className="border-b border-stone-100">
      <div
        className="flex items-center justify-between"
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        <NavLink
          to={url}
          className={({ isActive }) =>
            `flex-1 py-4 text-base font-medium tracking-wide transition-colors ${
              isActive
                ? "text-[#960018]"
                : "text-[#2B1F3D] hover:text-[#960018]"
            }`
          }
        >
          {category.name}
        </NavLink>

        {hasChildren && (
          <button
            type="button"
            onClick={() => setExpanded(prev => !prev)}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${category.name} subcategories`}
            className="p-3 text-[#2B1F3D] hover:text-[#960018]"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </button>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="bg-stone-50/70">
          {children.map(child => (
            <MobileCategoryItem
              key={child.id}
              category={child}
              categories={categories}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}


function MobileNavigation({ categories }: CategoryNavProps) {
  const rootCategories = categories.filter(
    category => category.parent_id === null
  );

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `py-4 border-b border-stone-100 text-base font-medium tracking-wide transition-colors ${
      isActive
        ? "text-[#960018]"
        : "text-[#2B1F3D] hover:text-[#960018]"
    }`;

  return (
    <div className="lg:hidden absolute top-full right-3 w-[70vw] max-w-[250px] bg-white rounded-xl shadow-2xl border border-stone-200/70 z-[100] overflow-hidden">
      <nav className="flex flex-col px-6 py-4 max-h-[calc(100vh-80px)] overflow-y-auto">
        <NavLink to="/products" end className={linkClass}>
          Shop All
        </NavLink>

        <NavLink to="/new-arrivals" className={linkClass}>
          New Arrivals
        </NavLink>

        {rootCategories.map(category => (
          <MobileCategoryItem
            key={category.id}
            category={category}
            categories={categories}
          />
        ))}

        <NavLink to="/gifting" className={linkClass}>
          Gifting
        </NavLink>
      </nav>
    </div>
  );
}


export default function Header() {
  const [show, setShow] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const { items: cartItems } = useCart();
  const { user } = useAuth();

  const isHome = location.pathname === "/";

  useEffect(() => {
  const fetchCategories = async () => {
    try {
      const data = await getActiveCategories();
      setCategories(data);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  fetchCategories();
}, []);

  /*
   * Close mobile menu whenever route changes
   */
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  /*
 * Close mobile menu on outside click or Escape
 */
useEffect(() => {
  if (!isMobileMenuOpen) return;

  const handleOutsideClick = (event: PointerEvent) => {
  const target = event.target;

  if (!(target instanceof Element)) return;

  if (
    mobileMenuRef.current?.contains(target) ||
    target.closest("[data-mobile-menu-toggle]")
  ) {
    return;
  }

  setIsMobileMenuOpen(false);
};

  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setIsMobileMenuOpen(false);
    }
  };

  document.addEventListener("pointerdown", handleOutsideClick);
  document.addEventListener("keydown", handleEscape);

  return () => {
    document.removeEventListener("pointerdown", handleOutsideClick);
    document.removeEventListener("keydown", handleEscape);
  };
}, [isMobileMenuOpen]);

  /*
   * Homepage scroll behavior
   */
  useEffect(() => {
    if (!isHome) {
      setShow(true);
      setScrolled(false);
      return;
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        setShow(false);
      } else {
        setShow(true);
      }

      setScrolled(currentScrollY > 50);
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [lastScrollY, isHome]);

  /*
   * Search handler
   */
  const handleSearch = (query: string) => {
    if (query.trim()) {
      navigate(`/products?search=${encodeURIComponent(query)}`);
    } else {
      navigate("/products");
    }

    setIsSearchOpen(false);
  };
 

  /*
   * White Header Icons
   */
  const NavIcons = () => (
    <div className="flex items-center space-x-3">

      {/* Search */}
      <button
        onClick={() => setIsSearchOpen(true)}
        className="p-2 hover:bg-stone-100 rounded-full transition group relative"
        title="Search"
      >
        <Search className="w-5 h-5 text-[#2B1F3D]" />

        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Search
        </span>
      </button>

      {/* Cart */}
      <button
        onClick={() => setIsCartOpen(true)}
        className="p-2 hover:bg-stone-100 rounded-full relative transition group"
        title="Cart"
      >
        <ShoppingCart className="w-5 h-5 text-[#2B1F3D]" />

        {cartItems.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#960018] text-white text-xs rounded-full flex items-center justify-center">
            {cartItems.length}
          </span>
        )}

        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Cart
        </span>
      </button>

      {/* Profile / Login */}
      {user ? (
        <Link
          to="/profile"
          className="p-2 hover:bg-stone-100 rounded-full transition group relative"
          title="Profile"
        >
          <User className="w-5 h-5 text-[#2B1F3D]" />

          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Profile
          </span>
        </Link>
      ) : (
        <Link
          to="/login"
          className="p-2 hover:bg-stone-100 rounded-full transition group relative"
          title="Login"
        >
          <User className="w-5 h-5 text-[#2B1F3D]" />

          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Login
          </span>
        </Link>
      )}

    </div>
  );

  /*
   * Transparent Header Icons
   */
  const NavIconsHome = () => (
    <div className="flex items-center space-x-3">

      {/* Search */}
      <button
        onClick={() => setIsSearchOpen(true)}
        className="p-2 hover:bg-white/20 rounded-full transition group relative"
        title="Search"
      >
        <Search className="w-5 h-5 text-white" />

        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Search
        </span>
      </button>

      {/* Cart */}
      <button
        onClick={() => setIsCartOpen(true)}
        className="p-2 hover:bg-white/20 rounded-full relative transition group"
        title="Cart"
      >
        <ShoppingCart className="w-5 h-5 text-white" />

        {cartItems.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#960018] text-white text-xs rounded-full flex items-center justify-center">
            {cartItems.length}
          </span>
        )}

        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Cart
        </span>
      </button>

      {/* Profile / Login */}
      {user ? (
        <Link
          to="/profile"
          className="p-2 hover:bg-white/20 rounded-full transition group relative"
          title="Profile"
        >
          <User className="w-5 h-5 text-white" />

          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Profile
          </span>
        </Link>
      ) : (
        <Link
          to="/login"
          className="p-2 hover:bg-white/20 rounded-full transition group relative"
          title="Login"
        >
          <User className="w-5 h-5 text-white" />

          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Login
          </span>
        </Link>
      )}

    </div>
  );

  /*
   * ============================================================
   * HOMEPAGE HEADER
   * ============================================================
   */
  if (isHome) {
    return (
      <header
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
          show ? "translate-y-0" : "-translate-y-full"
        } ${
          scrolled || isMegaMenuOpen
            ? "bg-white shadow-sm"
            : "bg-transparent"
        }`}
      >

        <div className="mx-auto px-4 pt-2 pb-2 max-w-7xl relative">

          {scrolled || isMegaMenuOpen ? (
            /*
             * HOMEPAGE — SCROLLED
             * White header
             */
            <div className="flex items-center justify-between min-h-[80px]">

              {/* Logo */}
              <div className="flex-shrink-0">
                <Link to="/">
                  <img
                    src="/carmin_logo.png"
                    alt="Carmin"
                    className="h-16"
                  />
                </Link>
              </div>

              {/* Menu */}
              <DesktopNavigation categories={categories} onMenuOpenChange={setIsMegaMenuOpen} />

              {/* Right Icons */}
              <div className="flex items-center justify-end">

                <NavIcons />

                <button data-mobile-menu-toggle
                  className="lg:hidden p-2 ml-1"
                  onClick={() =>
                    setIsMobileMenuOpen(!isMobileMenuOpen)
                  }
                  aria-label="Toggle menu"
                  aria-expanded={isMobileMenuOpen}
                >
                  {isMobileMenuOpen ? (
                    <X className="w-6 h-6 text-[#2B1F3D]" />
                  ) : (
                    <Menu className="w-6 h-6 text-[#2B1F3D]" />
                  )}
                </button>

              </div>

            </div>
          ) : (
            /*
             * HOMEPAGE — TOP
             * Transparent header
             */
            <div className="flex items-center justify-between min-h-[80px]">

              {/* Logo */}
              <div className="flex-shrink-0">
                <Link to="/">
                  <img
                    src="/Logo1.1.png"
                    alt="Carmin"
                    className="h-[5.5rem]"
                  />
                </Link>
              </div>

              {/* Menu */}
              <DesktopNavigation categories={categories} transparent onMenuOpenChange={setIsMegaMenuOpen} />

              {/* Right Icons */}
              <div className="flex items-center justify-end">

                <NavIconsHome />

                <button data-mobile-menu-toggle
                  className="lg:hidden p-2 ml-1"
                  onClick={() =>
                    setIsMobileMenuOpen(!isMobileMenuOpen)
                  }
                  aria-label="Toggle menu"
                  aria-expanded={isMobileMenuOpen}
                >
                  {isMobileMenuOpen ? (
                    <X className="w-6 h-6 text-white" />
                  ) : (
                    <Menu className="w-6 h-6 text-white" />
                  )}
                </button>

              </div>

            </div>
          )}

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
  <div ref={mobileMenuRef}>
    <MobileNavigation categories={categories} />
  </div>
)}

        </div>

        {/* Search */}
        {isSearchOpen && (
          <SearchBar
            onSearch={handleSearch}
            onClose={() => setIsSearchOpen(false)}
          />
        )}

        {/* Cart */}
        <CartDrawer
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
        />

      </header>
    );
  }

  /*
   * ============================================================
   * OTHER PAGES
   * ============================================================
   */
  return (
    <header className="sticky top-0 left-0 w-full z-50 bg-white shadow-sm">

      <div className="mx-auto px-4 py-3 max-w-7xl relative">

        <div className="flex items-center justify-between min-h-[70px]">

          {/* Logo */}
          <div className="flex-shrink-0">
            <Link to="/">
              <img
                src="/carmin_logo.png"
                alt="Carmin"
                className="h-14"
              />
            </Link>
          </div>

          {/* Menu */}
          <DesktopNavigation categories={categories} />

          {/* Right Icons */}
          <div className="flex items-center justify-end">

            <NavIcons />

            <button data-mobile-menu-toggle
              className="lg:hidden p-2 ml-1"
              onClick={() =>
                setIsMobileMenuOpen(!isMobileMenuOpen)
              }
              aria-label="Toggle menu"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6 text-[#2B1F3D]" />
              ) : (
                <Menu className="w-6 h-6 text-[#2B1F3D]" />
              )}
            </button>

          </div>

        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
  <div ref={mobileMenuRef}>
    <MobileNavigation categories={categories} />
  </div>
)}

      </div>

      {/* Search */}
      {isSearchOpen && (
        <SearchBar
          onSearch={handleSearch}
          onClose={() => setIsSearchOpen(false)}
        />
      )}

      {/* Cart */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
      />

    </header>
  );
}