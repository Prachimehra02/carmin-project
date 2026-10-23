import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, Package, ShoppingCart, Tag, ShieldCheck, Settings, FileText, Gift, FolderTree, Layers, SlidersHorizontal, Tags, Images } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gray-900 text-white transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8" />
            {sidebarOpen && <span className="font-bold text-lg">Admin</span>}
          </div>
        </div>

        {/* Navigation */}
        <nav className="admin-sidebar-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-2">
          <Link
            to="/admin"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/admin') && !location.pathname.startsWith('/admin/orders')
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Package className="w-5 h-5" />
            {sidebarOpen && <span>Products</span>}
          </Link>
          <Link
            to="/admin/orders"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/admin/orders')
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <ShoppingCart className="w-5 h-5" />
            {sidebarOpen && <span>Orders</span>}
          </Link>
          <Link
            to="/admin/coupons"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/admin/coupons')
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Tag className="w-5 h-5" />
            {sidebarOpen && <span>Coupons</span>}
          </Link>
          <Link
            to="/admin/promo-popups"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/admin/promo-popups')
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Gift className="w-5 h-5" />
            {sidebarOpen && <span>Promo Popups</span>}
          </Link>
          
          <Link
            to="/admin/categories"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/admin/categories')
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <FolderTree className="w-5 h-5" />
            {sidebarOpen && <span>Categories</span>}
          </Link>

          <Link
  to="/admin/media"
  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
    isActive('/admin/media')
      ? 'bg-blue-600 text-white'
      : 'text-gray-300 hover:bg-gray-800'
  }`}
>
  <Images className="w-5 h-5" />
  {sidebarOpen && <span>Media Library</span>}
</Link>

          <Link to="/admin/collections"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/admin/collections') ? 'bg-blue-600 text-white' 
              : 'text-gray-300 hover:bg-gray-800'}`}>
            <Layers className="w-5 h-5" />
            {sidebarOpen && <span>Collections</span>}
          </Link>
          
          <Link
            to="/admin/attributes"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/admin/attributes')
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`
            }
          >
            <SlidersHorizontal className="w-5 h-5" />
            {sidebarOpen && <span>Attributes</span>}
          </Link>

          <Link
            to="/admin/tags"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/admin/tags')
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`
            }
          >
            <Tags className="w-5 h-5" />
            {sidebarOpen && <span>Tags</span>}
          </Link>
          
          <Link
            to="/admin/launch-check"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/admin/launch-check')
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
            {sidebarOpen && <span>Launch Check</span>}
          </Link>
          <Link
            to="/admin/status-settings"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/admin/status-settings')
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Settings className="w-5 h-5" />
            {sidebarOpen && <span>Status Settings</span>}
          </Link>
          <Link
            to="/admin/hsn-master"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/admin/hsn-master')
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <FileText className="w-5 h-5" />
            {sidebarOpen && <span>HSN Master</span>}
          </Link>
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            {sidebarOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <div className="w-10"></div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide">
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
