import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { router } from "~/router";
import "~/ui/styles.css";

const desktopApi = Reflect.get(window, "arkini") as Window["arkini"] | undefined;

if (desktopApi === undefined) {
	throw new Error("Arkini Electron preload API is unavailable.");
}

const rootElement = document.getElementById("root");

if (!rootElement) {
	throw new Error("Arkini root element is missing.");
}

createRoot(rootElement).render(
	<StrictMode>
		<RouterProvider router={router} />
	</StrictMode>,
);
