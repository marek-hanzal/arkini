import { match } from "ts-pattern";
import type { GameLeaveDestinationSchema } from "~/@routes/action/-GameLeaveDestinationSchema";

/** Converts one launcher pathname into the exact post-release action destination. */
export const resolveLauncherLeaveDestinationFn = (
	pathname: string,
): GameLeaveDestinationSchema.Type =>
	match(pathname)
		.with("/about", () => ({
			destination: "about" as const,
		}))
		.with("/serapacks", () => ({
			destination: "serapacks" as const,
		}))
		.with("/settings", () => ({
			destination: "settings" as const,
		}))
		.otherwise(() => ({
			destination: "main-menu" as const,
		}));
