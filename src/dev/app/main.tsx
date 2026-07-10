import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { DevGamePackProvider } from "../pack/context/DevGamePackContext";
import { router } from "./router";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Arkini dev root element is missing.");
}

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: Number.POSITIVE_INFINITY,
			retry: false,
		},
		mutations: {
			retry: false,
		},
	},
});

createRoot(rootElement).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<DevGamePackProvider>
				<RouterProvider router={router} />
			</DevGamePackProvider>
		</QueryClientProvider>
	</StrictMode>,
);
