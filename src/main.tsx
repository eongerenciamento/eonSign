import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initPreventTopOverscroll } from "./lib/preventTopOverscroll";

initPreventTopOverscroll();

createRoot(document.getElementById("root")!).render(<App />);
