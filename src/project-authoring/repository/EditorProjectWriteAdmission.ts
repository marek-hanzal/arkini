import { Effect } from "effect";

import {
	EditorProjectRepositoryError,
	type EditorProjectRepositoryOperation,
} from "~/project-authoring/repository/EditorProjectRepositoryError";

let blocked = false;

/** Blocks renderer-originated editor writes while one terminal project replacement owns the UI. */
export const blockEditorProjectWrites = () => {
	if (blocked)
		throw new EditorProjectRepositoryError({
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

export const admitEditorProjectWriteFx = <Value>(
	operation: EditorProjectRepositoryOperation,
	effect: Effect.Effect<Value, EditorProjectRepositoryError>,
) =>
	Effect.suspend(() =>
		blocked
			? Effect.fail(
					new EditorProjectRepositoryError({
						operation,
						message: "The editor project is being replaced by a checked-out version.",
					}),
				)
			: effect,
	);
