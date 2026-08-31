import { Effect } from "effect";

import {
	ProjectRepositoryError,
	type ProjectRepositoryOperation,
} from "~/project-authoring/error/ProjectRepositoryError";
import type { ProjectWriteAdmissionService } from "~/project-authoring/service/ProjectWriteAdmission";

/** Creates one isolated write-admission authority for a renderer lifecycle. */
export const createProjectWriteAdmissionFx = Effect.sync(() => {
	let replacementActive = false;

	return {
		acquireReplacementFx: (operation) =>
			Effect.suspend(() => {
				if (replacementActive)
					return Effect.fail(
						new ProjectRepositoryError({
							operation,
							message: "Another editor project replacement is already running.",
						}),
					);
				replacementActive = true;
				let released = false;
				return Effect.succeed(
					Effect.sync(() => {
						if (released) return;
						released = true;
						replacementActive = false;
					}),
				);
			}),
		admitWriteFx: <Value, Error, Requirements>(
			operation: ProjectRepositoryOperation,
			effect: Effect.Effect<Value, Error, Requirements>,
		): Effect.Effect<Value, Error | ProjectRepositoryError, Requirements> =>
			Effect.suspend<Value, Error | ProjectRepositoryError, Requirements>(() =>
				replacementActive
					? Effect.fail(
							new ProjectRepositoryError({
								operation,
								message:
									"The editor project is being replaced by a checked-out or refreshed version.",
							}),
						)
					: effect,
			),
	} satisfies ProjectWriteAdmissionService;
});
