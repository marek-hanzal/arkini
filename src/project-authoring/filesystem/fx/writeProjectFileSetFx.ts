import { Effect } from "effect";

import type { FilesystemWrite } from "~/filesystem-write/service/FilesystemWrite";
import { withProjectLockFx } from "./withProjectLockFx";

export interface ProjectFileSetPlan {
	/** Validate the resulting project metadata after writing it. */
	readonly verifyFx?: Effect.Effect<void, unknown, never>;
	readonly writes: ReadonlyArray<
		{
			readonly target: string;
		} & (
			| {
					readonly bytes: Uint8Array;
					readonly source?: never;
			  }
			| {
					readonly bytes?: never;
					readonly source: string;
			  }
		)
	>;
	readonly deletes?: ReadonlyArray<string>;
}

/** Applies one ordered set of project file changes under the project write lock. */
export const writeProjectFileSetFx = Effect.fn("writeProjectFileSetFx")(
	<Failure, Requirements>({
		filesystemWrite,
		root,
		planFx,
	}: {
		readonly filesystemWrite: FilesystemWrite;
		readonly root: string;
		readonly planFx: Effect.Effect<ProjectFileSetPlan, Failure, Requirements>;
	}) =>
		withProjectLockFx(
			filesystemWrite,
			root,
			planFx.pipe(
				Effect.flatMap((plan) =>
					Effect.gen(function* () {
						// Admit writes and removals together before touching a portable project.
						// Otherwise a case/Unicode alias can delete the file just copied for a rename.
						const targets = new Map<string, string>();
						for (const target of [
							...plan.writes.map((write) => write.target),
							...(plan.deletes ?? []),
						]) {
							const key = target.normalize("NFD").toLowerCase();
							const previous = targets.get(key);
							if (previous !== undefined)
								return yield* Effect.fail(
									new Error(
										`Editor file operations for ${JSON.stringify(previous)} and ${JSON.stringify(target)} collide.`,
									),
								);
							targets.set(key, target);
						}
						for (const write of plan.writes)
							yield* write.source === undefined
								? filesystemWrite.replaceFileFx({
										lock: `${root}/editor.lock`,
										target: write.target,
										bytes: write.bytes,
									})
								: filesystemWrite.replaceFileFx({
										lock: `${root}/editor.lock`,
										target: write.target,
										source: write.source,
									});
						for (const target of plan.deletes ?? [])
							yield* filesystemWrite.removeFileFx({
								lock: `${root}/editor.lock`,
								target,
							});
						yield* plan.verifyFx ?? Effect.void;
					}),
				),
			),
		),
);
