import { Effect } from "effect";

import {
	ProjectRepositoryError,
	type ProjectRepositoryOperation,
} from "~/project-authoring/error/ProjectRepositoryError";
import type {
	ProjectReplacementOperation,
	ProjectWriteAdmissionService,
} from "~/project-authoring/service/ProjectWriteAdmission";

/** Creates one isolated write-admission authority for a renderer lifecycle. */
export const createProjectWriteAdmissionFx = Effect.sync(() => {
	let activeOperation: ProjectReplacementOperation | "rename-project" | undefined;
	const acquireFx = (
		operation: NonNullable<typeof activeOperation>,
		isNavigationPendingFn: () => boolean,
	) =>
		Effect.suspend(() => {
			const repositoryOperation =
				operation === "rename-project" ? "replace-config" : operation;
			if (activeOperation !== undefined)
				return Effect.fail(
					new ProjectRepositoryError({
						operation: repositoryOperation,
						message:
							"Another editor project replacement or identity rename is already running.",
					}),
				);
			if (isNavigationPendingFn())
				return Effect.fail(
					new ProjectRepositoryError({
						operation: repositoryOperation,
						message: "The editor is navigating to another route.",
					}),
				);
			activeOperation = operation;
			let released = false;
			return Effect.succeed(
				Effect.sync(() => {
					if (released) return;
					released = true;
					activeOperation = undefined;
				}),
			);
		});
	return {
		isNavigationBlockedFn: () => activeOperation !== undefined,
		acquireReplacementFx: acquireFx,
		acquireIdentityRenameFx: (isNavigationPendingFn) =>
			acquireFx("rename-project", isNavigationPendingFn),
		admitWriteFx: <Value, Error, Requirements>(
			operation: ProjectRepositoryOperation,
			effect: Effect.Effect<Value, Error, Requirements>,
		): Effect.Effect<Value, Error | ProjectRepositoryError, Requirements> =>
			Effect.suspend<Value, Error | ProjectRepositoryError, Requirements>(() =>
				activeOperation !== undefined && activeOperation !== "rename-project"
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
