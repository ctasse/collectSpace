import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeRoot } from "./ThemeRoot";

const container = document.getElementById("root");
if (!container) throw new Error("缺少 #root 容器");

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <ThemeRoot>
      <App />
    </ThemeRoot>
  </React.StrictMode>,
);
