// vite.config.ts
import { defineConfig, loadEnv } from "file:///C:/Users/WO199/OneDrive/Documents/Proyectos/agent-manager/node_modules/vite/dist/node/index.js";
import vue from "file:///C:/Users/WO199/OneDrive/Documents/Proyectos/agent-manager/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import tailwindcss from "file:///C:/Users/WO199/OneDrive/Documents/Proyectos/agent-manager/node_modules/@tailwindcss/vite/dist/index.mjs";
import { fileURLToPath, URL } from "node:url";
var __vite_injected_original_import_meta_url = "file:///C:/Users/WO199/OneDrive/Documents/Proyectos/agent-manager/frontend/vite.config.ts";
var vite_config_default = defineConfig((env) => {
  const envars = loadEnv(env.mode, "../");
  console.log(envars);
  return {
    plugins: [
      tailwindcss(),
      vue()
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url))
      }
    },
    base: "/",
    server: {
      proxy: {
        "/api": {
          target: envars.VITE_SERVER_URL,
          changeOrigin: true
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxXTzE5OVxcXFxPbmVEcml2ZVxcXFxEb2N1bWVudHNcXFxcUHJveWVjdG9zXFxcXGFnZW50LW1hbmFnZXJcXFxcZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXFdPMTk5XFxcXE9uZURyaXZlXFxcXERvY3VtZW50c1xcXFxQcm95ZWN0b3NcXFxcYWdlbnQtbWFuYWdlclxcXFxmcm9udGVuZFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvV08xOTkvT25lRHJpdmUvRG9jdW1lbnRzL1Byb3llY3Rvcy9hZ2VudC1tYW5hZ2VyL2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHZ1ZSBmcm9tICdAdml0ZWpzL3BsdWdpbi12dWUnXHJcbmltcG9ydCB0YWlsd2luZGNzcyBmcm9tICdAdGFpbHdpbmRjc3Mvdml0ZSdcclxuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgVVJMIH0gZnJvbSAnbm9kZTp1cmwnXHJcbmltcG9ydCB7IGVudiB9IGZyb20gJ25vZGU6cHJvY2Vzcyc7XHJcblxyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKChlbnYpID0+IHtcclxuICBjb25zdCBlbnZhcnMgPSBsb2FkRW52KGVudi5tb2RlLCAnLi4vJyk7XHJcbiAgY29uc29sZS5sb2coZW52YXJzKVxyXG4gIHJldHVybiB7XHJcbiAgICBwbHVnaW5zOiBbXHJcbiAgICAgIHRhaWx3aW5kY3NzKCksXHJcbiAgICAgIHZ1ZSgpLFxyXG4gICAgXSxcclxuICAgIHJlc29sdmU6IHtcclxuICAgICAgYWxpYXM6IHtcclxuICAgICAgICAnQCc6IGZpbGVVUkxUb1BhdGgobmV3IFVSTCgnLi9zcmMnLCBpbXBvcnQubWV0YS51cmwpKSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBiYXNlOiAnLycsXHJcbiAgICBzZXJ2ZXI6IHtcclxuICAgICAgcHJveHk6IHtcclxuICAgICAgICAnL2FwaSc6IHtcclxuICAgICAgICAgIHRhcmdldDogIGVudmFycy5WSVRFX1NFUlZFUl9VUkwsXHJcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfVxyXG59KVxyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXdZLFNBQVMsY0FBYyxlQUFlO0FBQzlhLE9BQU8sU0FBUztBQUNoQixPQUFPLGlCQUFpQjtBQUN4QixTQUFTLGVBQWUsV0FBVztBQUh3TixJQUFNLDJDQUEyQztBQU81UyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxRQUFRO0FBQ25DLFFBQU0sU0FBUyxRQUFRLElBQUksTUFBTSxLQUFLO0FBQ3RDLFVBQVEsSUFBSSxNQUFNO0FBQ2xCLFNBQU87QUFBQSxJQUNMLFNBQVM7QUFBQSxNQUNQLFlBQVk7QUFBQSxNQUNaLElBQUk7QUFBQSxJQUNOO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDUCxPQUFPO0FBQUEsUUFDTCxLQUFLLGNBQWMsSUFBSSxJQUFJLFNBQVMsd0NBQWUsQ0FBQztBQUFBLE1BQ3REO0FBQUEsSUFDRjtBQUFBLElBQ0EsTUFBTTtBQUFBLElBQ04sUUFBUTtBQUFBLE1BQ04sT0FBTztBQUFBLFFBQ0wsUUFBUTtBQUFBLFVBQ04sUUFBUyxPQUFPO0FBQUEsVUFDaEIsY0FBYztBQUFBLFFBQ2hCO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
