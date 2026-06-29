import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const ListingDetail = lazy(() => import("./pages/ListingDetail"));
const Messages = lazy(() => import("./pages/Messages"));
const EscrowCaseDetail = lazy(() => import("./pages/EscrowCaseDetail"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const EscrowCases = lazy(() => import("./pages/admin/EscrowCases"));
const AdminEscrowCaseDetail = lazy(() => import("./pages/admin/AdminEscrowCaseDetail"));
const PaymentReview = lazy(() => import("./pages/admin/PaymentReview"));
const SellerVerification = lazy(() => import("./pages/admin/SellerVerification"));
const DeliveryManagement = lazy(() => import("./pages/admin/DeliveryManagement"));
const Disputes = lazy(() => import("./pages/admin/Disputes"));
const Payouts = lazy(() => import("./pages/admin/Payouts"));
const Analytics = lazy(() => import("./pages/admin/Analytics"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AuditLogs = lazy(() => import("./pages/admin/AuditLogs"));
const CreateListing = lazy(() => import("./pages/CreateListing"));
const BulkUpload = lazy(() => import("./pages/BulkUpload"));
const Wallet = lazy(() => import("./pages/Wallet"));
const PaymentSettings = lazy(() => import("./pages/admin/PaymentSettings"));
const AdminListings = lazy(() => import("./pages/admin/Listings"));
const AdminMessages = lazy(() => import("./pages/admin/AdminMessages"));
const AdminWallets = lazy(() => import("./pages/admin/Wallets"));
const AdminCategories = lazy(() => import("./pages/admin/Categories"));
const AdminHomepageCategories = lazy(() => import("./pages/admin/HomepageCategories"));
const AdminFeaturedListings = lazy(() => import("./pages/admin/FeaturedListings"));
const Profile = lazy(() => import("./pages/Profile"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#FFFDF5' }}>
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#E8A800', borderTopColor: 'transparent' }} />
                <p className="text-sm font-medium" style={{ color: '#9A7C40' }}>Loading...</p>
              </div>
            </div>
          }>
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
            <Route path="/sell/bulk" element={<BulkUpload />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Dashboard />} />

            {/* Admin Routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="listings" element={<AdminListings />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="bulk-upload" element={<BulkUpload />} />
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
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
