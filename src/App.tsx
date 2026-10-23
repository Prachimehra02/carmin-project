import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import CategoryPage from './pages/CategoryPage';
import NewArrival from './pages/NewArrival';
import HomeDecor from './pages/HomeDecor';
import About from './pages/About';
import Contact from './pages/Contact';
import Cart from './pages/Cart';
import Wishlist from './pages/Wishlist';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import LoginOTP from './pages/LoginOTP';
import Profile from './pages/Profile';
import OrderDetails from './pages/OrderDetails';
import Gifting from './pages/Gifting';
import AdminProducts from './pages/AdminProducts';
import AdminAddProduct from './pages/AdminAddProduct';
import AdminEditProduct from './pages/AdminEditProduct';
import AdminOrders from './pages/AdminOrders';
import AdminCoupons from './pages/AdminCoupons';
import AdminLaunchCheck from './pages/AdminLaunchCheck';
import AdminStatusSettings from './pages/AdminStatusSettings';
import AdminHsnMaster from './pages/AdminHsnMaster';
import AdminPromoPopups from './pages/AdminPromoPopups';
import AdminCategories from './pages/AdminCategories';
import PromoPopup from './components/PromoPopup';
import Invoice from './pages/Invoice';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { AuthProvider } from './context/AuthContext';
import AdminCollections from './pages/AdminCollections';
import AdminAttributes from './pages/AdminAttributes';
import AdminTags from './pages/AdminTags';
import AdminMediaLibrary from "./pages/AdminMediaLibrary";

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function AppContent() {
  const { pathname } = useLocation();
  const isAdminPage = pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-white">
      <ScrollToTop />
      {!isAdminPage && <Header />}
      <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/products" element={<Products />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/category/*" element={<CategoryPage />} />
              <Route path="/new-arrivals" element={<NewArrival />} />
              <Route path="/home-decor" element={<HomeDecor />} />
              <Route path="/gifting" element={<Gifting />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/checkout" element={<ProtectedRoute><Checkout />
              </ProtectedRoute>} />
              <Route path="/order-confirmation" element={<OrderConfirmation />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/login-otp" element={<LoginOTP />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin/media" element={<AdminMediaLibrary />}/>
              <Route
                path="/account/orders/:orderId"
                element={
                  <ProtectedRoute>
                    <OrderDetails />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminProducts />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/products/add"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminAddProduct />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/products/edit/:id"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminEditProduct />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/orders"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminOrders />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/coupons"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminCoupons />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/launch-check"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminLaunchCheck />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/status-settings"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminStatusSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/hsn-master"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminHsnMaster />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/promo-popups"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminPromoPopups />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/categories"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminCategories />
                  </ProtectedRoute>
                }
              />
              <Route path="/admin/collections" element={<ProtectedRoute requireAdmin> 
                <AdminCollections /> </ProtectedRoute>}/>
              <Route
                path="/admin/attributes"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminAttributes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/tags"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminTags />
                  </ProtectedRoute>
                }
              />
              <Route path="/account/orders/:orderId/invoice" element={<ProtectedRoute> <Invoice /> </ProtectedRoute> } />
        
            </Routes>
      
      {!isAdminPage && <Footer />}
      {!isAdminPage && <PromoPopup />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <AppContent />
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
