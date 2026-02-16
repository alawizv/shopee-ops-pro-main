/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import BarcodeGenerator from './pages/BarcodeGenerator';
import CetakBarcode from './pages/CetakBarcode';
import Dashboard from './pages/Dashboard';
import DownloadBarcodeJPG from './pages/DownloadBarcodeJPG';
import ProductBrandMapping from './pages/ProductBrandMapping';
import Settings from './pages/Settings';
import ShopeePencairan from './pages/ShopeePencairan';
import ShopeeProcessOrder from './pages/ShopeeProcessOrder';
import TikTokPlaceholder from './pages/TikTokPlaceholder';
import TikTokProcessOrder from './pages/TikTokProcessOrder';
import TikTokPencairan from './pages/TikTokPencairan';
import __Layout from './Layout.jsx';


export const PAGES = {
    "BarcodeGenerator": BarcodeGenerator,
    "CetakBarcode": CetakBarcode,
    "Dashboard": Dashboard,
    "DownloadBarcodeJPG": DownloadBarcodeJPG,
    "ProductBrandMapping": ProductBrandMapping,
    "Settings": Settings,
    "ShopeePencairan": ShopeePencairan,
    "ShopeeProcessOrder": ShopeeProcessOrder,
    "TikTokPlaceholder": TikTokPlaceholder,
    "TikTokProcessOrder": TikTokProcessOrder,
    "TikTokPencairan": TikTokPencairan,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};