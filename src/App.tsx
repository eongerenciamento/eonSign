import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Documents from "./pages/Documents";
import Drive from "./pages/Drive";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import Pricing from "./pages/Pricing";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import NewDocument from "./pages/NewDocument";
import SignDocument from "./pages/SignDocument";
import ValidateDocument from "./pages/ValidateDocument";
import CertificatePurchase from "./pages/CertificatePurchase";
import ProtectedRoute from "./components/ProtectedRoute";
const queryClient = new QueryClient();
const AppRoutes = () => {
  return <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/planos" element={<Pricing />} />
      <Route path="/install" element={<Install />} />
      <Route path="/assinar/:documentId" element={<SignDocument />} />
      <Route path="/validar/:documentId" element={<ValidateDocument />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/documentos" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
      <Route path="/drive" element={<ProtectedRoute><Drive /></ProtectedRoute>} />
      <Route path="/novo-documento" element={<ProtectedRoute><NewDocument /></ProtectedRoute>} />
      <Route path="/relatorios" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/configuracoes" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/certificado" element={<ProtectedRoute><CertificatePurchase /></ProtectedRoute>} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>;
};
const App = () => {
  return <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>;
};
export default App;