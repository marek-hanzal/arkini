import { Effect } from "effect";

import {
	ProjectRepositoryError,
	type ProjectRepositoryOperation,
} from "~/project-authoring/error/ProjectRepositoryError";

let blocked = false;

/** Blocks renderer-originated editor writes while one terminal project replacement owns the UI. */
export const blockProjectWrites = () => {
	if (blocked)
		throw new ProjectRepositoryError({
			operation: "checkout-version",
			message: "Another editor project replacement is already running.",
		});
	blocked = true;
	let released = false;
	return () => {
		if (released) return;
		released = true;
		blocked = false;
	};
};

export const admitProjectWriteFx = <Value>(
	operation: ProjectRepositoryOperation,
	effect: Effect.Effect<Value, ProjectRepositoryError>,
) =>
	Effect.suspend(() =>
		blocked
			? Effect.fail(
					new ProjectRepositoryError({
						operation,
						message: "The editor project is being replaced by a checked-out version.",
					}),
				)
			: effect,
	);
