import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { LoginGate } from "./components/LoginGate";

const AdminPanel = lazy(() => import("./pages/AdminPanel.tsx"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <LoginGate>
        <HashRouter>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </HashRouter>
      </LoginGate>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
