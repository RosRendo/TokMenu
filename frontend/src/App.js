import { Component, lazy, Suspense } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { LangProvider } from "@/lib/i18n";
import { AuthShell, RequireMember, RequireAdmin, OwnerOnly } from "@/lib/auth";
import { PageLoader } from "@/components/Loading";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("TokMenu ErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background">
          <div className="max-w-md rounded-2xl border bg-card p-8 shadow-xl">
            <h2 className="font-display text-2xl font-bold">Something went wrong</h2>
            <p className="mt-2 text-sm text-muted-foreground">The page encountered an unexpected issue. Please reload to try again.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:opacity-90"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const Landing = lazy(() => import("@/pages/Landing"));
const Pricing = lazy(() => import("@/pages/Pricing"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const MenuPage = lazy(() => import("@/pages/menu/MenuPage"));
const CartPage = lazy(() => import("@/pages/menu/CartPage"));
const OrderStatusPage = lazy(() => import("@/pages/menu/OrderStatusPage"));
const Login = lazy(() => import("@/pages/auth/Login"));
const Register = lazy(() => import("@/pages/auth/Register"));
const ForgotPassword = lazy(() => import("@/pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/auth/ResetPassword"));
const AcceptInvite = lazy(() => import("@/pages/auth/AcceptInvite"));
const DashboardLayout = lazy(() => import("@/pages/dashboard/DashboardLayout"));
const Overview = lazy(() => import("@/pages/dashboard/Overview"));
const Orders = lazy(() => import("@/pages/dashboard/Orders"));
const MenuItems = lazy(() => import("@/pages/dashboard/MenuItems"));
const Categories = lazy(() => import("@/pages/dashboard/Categories"));
const Tables = lazy(() => import("@/pages/dashboard/Tables"));
const QrCodes = lazy(() => import("@/pages/dashboard/QrCodes"));
const Analytics = lazy(() => import("@/pages/dashboard/Analytics"));
const Staff = lazy(() => import("@/pages/dashboard/Staff"));
const Settings = lazy(() => import("@/pages/dashboard/Settings"));
const Billing = lazy(() => import("@/pages/dashboard/Billing"));
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminOverview = lazy(() => import("@/pages/admin/AdminOverview"));
const AdminRestaurants = lazy(() => import("@/pages/admin/AdminRestaurants"));
const AdminSubscriptions = lazy(() => import("@/pages/admin/AdminSubscriptions"));
const AdminSupport = lazy(() => import("@/pages/admin/AdminSupport"));

const owner = (el) => <OwnerOnly>{el}</OwnerOnly>;

function App() {
  return (
    <div className="App">
      <LangProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/menu/:slug" element={<MenuPage />} />
              <Route path="/menu/:slug/cart" element={<CartPage />} />
              <Route path="/menu/:slug/order/:code" element={<OrderStatusPage />} />
              <Route element={<AuthShell />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/accept-invite" element={<AcceptInvite />} />
                <Route path="/dashboard" element={<RequireMember><DashboardLayout /></RequireMember>}>
                  <Route index element={owner(<Overview />)} />
                  <Route path="orders" element={<Orders />} />
                  <Route path="menu" element={<MenuItems />} />
                  <Route path="menu/categories" element={owner(<Categories />)} />
                  <Route path="tables" element={owner(<Tables />)} />
                  <Route path="qr-codes" element={owner(<QrCodes />)} />
                  <Route path="analytics" element={owner(<Analytics />)} />
                  <Route path="staff" element={owner(<Staff />)} />
                  <Route path="settings" element={owner(<Settings />)} />
                  <Route path="billing" element={owner(<Billing />)} />
                </Route>
                <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
                  <Route index element={<AdminOverview />} />
                  <Route path="restaurants" element={<AdminRestaurants />} />
                  <Route path="subscriptions" element={<AdminSubscriptions />} />
                  <Route path="support" element={<AdminSupport />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <Toaster position="top-center" richColors closeButton />
        </BrowserRouter>
        </ErrorBoundary>
      </LangProvider>
    </div>
  );
}

export default App;
