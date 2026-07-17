import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { readAppearanceThemeFx } from "~/bridge/appearance/readAppearanceThemeFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { router } from "~/router";
import { AppearanceProvider } from "~/ui/appearance/AppearanceProvider";
import "~/ui/styles.css";

const desktopApi = Reflect.get(window, "arkini") as Window["arkini"] | undefined;

if (desktopApi === undefined) {
	throw new Error("Arkini Electron preload API is unavailable.");
}

const rootElement = document.getElementById("root");

if (!rootElement) {
	throw new Error("Arkini root element is missing.");
}

const initialTheme = await RendererRuntime.runPromise(readAppearanceThemeFx());
document.documentElement.dataset.theme = initialTheme;

createRoot(rootElement).render(
	<StrictMode>
		<AppearanceProvider initialTheme={initialTheme}>
			<RouterProvider router={router} />
		</AppearanceProvider>
	</StrictMode>,
);
