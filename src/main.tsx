import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import "@ant-design/x-markdown/themes/light.css";
import App from "./app/session-app";
import "./styles.css";
import { appTheme } from "./theme";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={appTheme}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
