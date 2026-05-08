import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Pack from "./pages/Pack";
import ItemsByBox from "./pages/ItemsByBox";
import FindItem from "./pages/FindItem";
import AllBoxes from "./pages/AllBoxes";
import ItemDetail from "./pages/ItemDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/pack" element={<Pack />} />
          <Route path="/items-by-box" element={<ItemsByBox />} />
          <Route path="/find-item" element={<FindItem />} />
          <Route path="/all-boxes" element={<AllBoxes />} />
          <Route path="/item-detail/:id" element={<ItemDetail />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;