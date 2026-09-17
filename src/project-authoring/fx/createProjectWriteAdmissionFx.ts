import { Context, Effect, Semaphore } from "effect";

import {
	ProjectRepositoryError,
	type ProjectRepositoryOperation,
} from "~/project-authoring/error/ProjectRepositoryError";
import type {
	ProjectReplacementOperation,
	ProjectWriteAdmissionService,
} from "~/project-authoring/service/ProjectWriteAdmission";

const HeldWriteAdmissions = Context.Reference<ReadonlyMap<symbol, number>>(
	"Arkini/ProjectWriteAdmission/Held",
	{
		defaultValue: () => new Map(),
	},
);

/** Creates one isolated write-admission authority for a renderer lifecycle. */
export const createProjectWriteAdmissionFx = Effect.gen(function* () {
	const writes = yield* Semaphore.make(1);
	const identity = Symbol();
	let activeOperation: ProjectReplacementOperation | "rename-project" | undefined;
	const acquireFx = (
		operation: NonNullable<typeof activeOperation>,
		isNavigationPendingFn: () => boolean,
	) =>
		Effect.gen(function* () {
			const repositoryOperation =
				operation === "rename-project" ? "replace-config" : operation;
			if (activeOperation !== undefined)
				return yield* Effect.fail(
					new ProjectRepositoryError({
						operation: repositoryOperation,
						message:
							"Another editor project replacement or identity rename is already running.",
					}),
				);
			if (isNavigationPendingFn())
				return yield* Effect.fail(
					new ProjectRepositoryError({
						operation: repositoryOperation,
						message: "The editor is navigating to another route.",
					}),
				);
			activeOperation = operation;
			// Close admission before draining accepted writes, including their preparation/publication.
			yield* writes
				.withPermits(1)(Effect.void)
				.pipe(
					Effect.onError(() =>
						Effect.sync(() => {
							activeOperation = undefined;
						}),
					),
				);
			let released = false;
			return yield* Effect.succeed(
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
			Effect.gen(function* () {
				const held = yield* HeldWriteAdmissions;
				const fiberId = yield* Effect.fiberId;
				// An admitted command may call the same repository gate while Refresh drains it.
				if (held.get(identity) === fiberId) return yield* effect;
				if (activeOperation !== undefined && activeOperation !== "rename-project") {
					return yield* Effect.fail(
						new ProjectRepositoryError({
							operation,
							message: "The editor project is being refreshed from its saved state.",
						}),
					);
				}
				return yield* writes.withPermits(1)(
					effect.pipe(
						Effect.provideService(
							HeldWriteAdmissions,
							new Map(held).set(identity, fiberId),
						),
					),
				);
			}),
	} satisfies ProjectWriteAdmissionService;
});
