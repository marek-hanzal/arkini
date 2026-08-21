import { Effect } from "effect";

/** Opens Arkini's platform-owned user-data root in the system file manager. */
export const openUserDataDirectoryFx = Effect.fn("openUserDataDirectoryFx")(() =>
	Effect.tryPromise({
		try: () => window.arkini.userData.openDirectory(),
		catch: (cause) => cause,
	}),
);
