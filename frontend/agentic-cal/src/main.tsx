import { createRoot } from "react-dom/client";
import "./firebase.js";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
