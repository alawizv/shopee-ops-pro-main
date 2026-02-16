import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  FileText, 
  DollarSign, 
  Video, 
  Settings, 
  Menu, 
  X,
  ChevronRight,
  Barcode
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const navigation = [
    { name: 'Dashboard', page: 'Dashboard', icon: LayoutDashboard },
    { 
      name: 'Shopee', 
      icon: ShoppingBag,
      children: [
        { name: 'Proses Order', page: 'ShopeeProcessOrder', icon: FileText },
        { name: 'Pencairan / Income', page: 'ShopeePencairan', icon: DollarSign }
      ]
    },
    { 
      name: 'TikTok', 
      icon: Video,
      children: [
        { name: 'Proses Order TikTok', page: 'TikTokProcessOrder', icon: FileText },
        { name: 'Pencairan / Income', page: 'TikTokPencairan', icon: DollarSign }
      ]
    },
    { name: 'Mapping Produk & Brand', page: 'ProductBrandMapping', icon: FileText },
    { 
      name: 'Barcode Generator', 
      icon: Barcode,
      children: [
        { name: 'Cetak Barcode', page: 'CetakBarcode', icon: FileText },
        { name: 'Download Barcode (JPG)', page: 'DownloadBarcodeJPG', icon: FileText }
      ]
    },
    { name: 'Settings', page: 'Settings', icon: Settings }
  ];
  
  const NavItem = ({ item, depth = 0 }) => {
    const [expanded, setExpanded] = useState(true);
    const isActive = currentPageName === item.page;
    const hasChildren = item.children && item.children.length > 0;
    
    if (hasChildren) {
      return (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-colors",
              "text-slate-700 hover:bg-slate-100"
            )}
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-5 h-5" />
              <span>{item.name}</span>
            </div>
            <ChevronRight className={cn(
              "w-4 h-4 transition-transform",
              expanded && "rotate-90"
            )} />
          </button>
          {expanded && (
            <div className="ml-4 mt-1 space-y-1">
              {item.children.map((child) => (
                <NavItem key={child.page} item={child} depth={depth + 1} />
              ))}
            </div>
          )}
        </div>
      );
    }
    
    return (
      <Link
        to={createPageUrl(item.page)}
        className={cn(
          "flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-all",
          isActive 
            ? "bg-blue-600 text-white shadow-md" 
            : "text-slate-700 hover:bg-slate-100",
          depth > 0 && "ml-2"
        )}
        onClick={() => setSidebarOpen(false)}
      >
        <div className="flex items-center gap-3">
          <item.icon className="w-5 h-5" />
          <span>{item.name}</span>
        </div>
        {item.badge && (
          <span className={cn(
            "px-2 py-0.5 text-xs font-semibold rounded-full",
            isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
          )}>
            {item.badge}
          </span>
        )}
      </Link>
    );
  };
  
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-slate-100"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        <h1 className="text-xl font-bold text-slate-900">Shopee Ops</h1>
      </div>
      
      {/* Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 bottom-0 z-50 w-72 bg-white border-r border-slate-200 transition-transform lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="p-6 border-b border-slate-200">
            <h1 className="text-2xl font-bold text-slate-900">Shopee Ops</h1>
            <p className="text-sm text-slate-600 mt-1">Transformer</p>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navigation.map((item) => (
              <NavItem key={item.page || item.name} item={item} />
            ))}
          </nav>
          
          {/* Footer */}
          <div className="p-4 border-t border-slate-200">
            <p className="text-xs text-slate-500 text-center">
              Built with Base44
            </p>
          </div>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className={cn(
        "lg:ml-72 pt-16 lg:pt-0",
        "min-h-screen"
      )}>
        {children}
      </main>
    </div>
  );
}