import { TooltipProvider } from "@/components/ui/tooltip";
import { Analytics } from "@vercel/analytics/react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { HemicyclePlayground } from "./pages/HemicyclePlayground";
import Home from "./pages/Home";
import "./style.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "playground",
    element: <HemicyclePlayground />,
  },
]);

const App = () => {
  return (
      <TooltipProvider>
        <RouterProvider router={router} />
        <Analytics />
      </TooltipProvider>
  );
};

createRoot(document.getElementById("app")!).render(<App />);
