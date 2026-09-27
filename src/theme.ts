import { theme } from "antd";
import type { ThemeConfig } from "antd";

export const appTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: "#22c7dd",
    colorSuccess: "#49c999",
    colorWarning: "#f5bc65",
    colorError: "#ef747c",
    colorInfo: "#22c7dd",
    colorTextBase: "#f2f4f8",
    colorBgBase: "#0b0b0e",
    colorBgContainer: "#17171b",
    colorBgElevated: "#202027",
    colorBgLayout: "#0b0b0e",
    colorBorder: "#303038",
    colorBorderSecondary: "#27272e",
    borderRadius: 10,
    controlHeight: 40,
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  components: {
    Button: { defaultShadow: "none", primaryShadow: "none" },
    Modal: { contentBg: "#17171b", headerBg: "#17171b" },
    Tabs: { itemSelectedColor: "#22c7dd", inkBarColor: "#22c7dd" },
  },
};
