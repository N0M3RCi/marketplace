import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Marketplace from "./pages/Marketplace";
import ListingDetail from "./pages/ListingDetail";
import Messages from "./pages/Messages";
import EscrowCaseDetail from "./pages/EscrowCaseDetail";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import EscrowCases from "./pages/admin/EscrowCases";
import AdminEscrowCaseDetail from "./pages/admin/AdminEscrowCaseDetail";
import PaymentReview from "./pages/admin/PaymentReview";
import SellerVerification from "./pages/admin/SellerVerification";
import DeliveryManagement from "./pages/admin/DeliveryManagement";
import Disputes from "./pages/admin/Disputes";
import Payouts from "./pages/admin/Payouts";
import Analytics from "./pages/admin/Analytics";
import AdminUsers from "./pages/admin/Users";
import AuditLogs from "./pages/admin/AuditLogs";
import CreateListing from "./pages/CreateListing";
import Wallet from "./pages/Wallet";
import PaymentSettings from "./pages/admin/PaymentSettings";
import AdminListings from "./pages/admin/Listings";
import AdminMessages from "./pages/admin/AdminMessages";
import AdminWallets from "./pages/admin/Wallets";
import AdminCategories from "./pages/admin/Categories";
import AdminHomepageCategories from "./pages/admin/HomepageCategories";
import AdminFeaturedListings from "./pages/admin/FeaturedListings";
import Profile from "./pages/Profile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/listing/:id" element={<ListingDetail />} />

            {/* User Routes */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/escrow/:id" element={<EscrowCaseDetail />} />
            <Route path="/sell" element={<CreateListing />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Dashboard />} />

            {/* Admin Routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="listings" element={<AdminListings />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="homepage-categories" element={<AdminHomepageCategories />} />
              <Route path="featured-listings" element={<AdminFeaturedListings />} />
              <Route path="messages" element={<AdminMessages />} />
              <Route path="escrow" element={<EscrowCases />} />
              <Route path="escrow/:id" element={<AdminEscrowCaseDetail />} />
              <Route path="wallets" element={<AdminWallets />} />
              <Route path="payments" element={<PaymentReview />} />
              <Route path="seller-verification" element={<SellerVerification />} />
              <Route path="delivery" element={<DeliveryManagement />} />
              <Route path="disputes" element={<Disputes />} />
              <Route path="payouts" element={<Payouts />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route path="payment-settings" element={<PaymentSettings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
