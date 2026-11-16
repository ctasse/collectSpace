import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
    environment: "node",
    // EchoTrace 同款：Windows/OneDrive 下并行写临时文件偶发 EPERM
    fileParallelism: false,
  },
});
