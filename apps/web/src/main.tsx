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
  return <RouterProvider router={router} />;
};

createRoot(document.getElementById("app")!).render(<App />);
