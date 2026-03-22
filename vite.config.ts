import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function mpaDevRoutes(): Plugin {
	return {
		name: "mpa-dev-routes",
		configureServer(server) {
			server.middlewares.use((req, _res, next) => {
				const url = (req.url ?? "/").split("?")[0];
				if (url === "/sessions") {
					req.url = "/sessions.html";
				} else if (url === "/" || url === "/chains") {
					req.url = "/chains.html";
				} else if (url === "/login") {
					req.url = "/login.html";
				} else if (url === "/callback") {
					req.url = "/callback.html";
				} else if (url.startsWith("/schedule/")) {
					req.url = "/schedule.html";
				}
				next();
			});
		},
	};
}

export default defineConfig({
	root: "src",
	publicDir: resolve(__dirname, "public"),
	plugins: [mpaDevRoutes()],
	server: {
		port: 3000,
		allowedHosts: true,
	},
	build: {
		outDir: resolve(__dirname, "dist"),
		emptyOutDir: true,
		rollupOptions: {
			input: {
				login: resolve(__dirname, "src/login.html"),
				callback: resolve(__dirname, "src/callback.html"),
				chains: resolve(__dirname, "src/chains.html"),
				sessions: resolve(__dirname, "src/sessions.html"),
				schedule: resolve(__dirname, "src/schedule.html"),
			},
		},
	},
	resolve: {
		alias: { "@": resolve(__dirname, "src/ts") },
	},
});
