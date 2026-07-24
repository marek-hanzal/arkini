import { Effect } from "effect";
import type { GameLeaveDestinationSchema } from "~/ui/navigation/GameLeaveDestinationSchema";

/** Converts one launcher pathname into the exact post-release action destination. */
export const resolveLauncherLeaveDestinationFx = Effect.fn("resolveLauncherLeaveDestinationFx")(
	(pathname: string) =>
		Effect.sync((): GameLeaveDestinationSchema.Type => {
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
		}),
);
