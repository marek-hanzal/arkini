import type { GameLeaveDestinationSchema } from "~/@routes/action/-GameLeaveDestinationSchema";

/** Converts one launcher pathname into the exact post-release action destination. */
export const resolveLauncherLeaveDestinationFn = (
	pathname: string,
): GameLeaveDestinationSchema.Type => {
	switch (pathname) {
		case "/about":
			return {
				destination: "about",
			};
		case "/arkpacks":
			return {
				destination: "arkpacks",
			};
		case "/settings":
			return {
				destination: "settings",
			};
		default:
			return {
				destination: "main-menu",
			};
	}
};
