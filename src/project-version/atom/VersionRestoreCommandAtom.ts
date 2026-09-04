import { Cause, Clock, Duration, Effect, Exit } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { EditorUnsavedChanges } from "~/authoring-session/service/EditorUnsavedChanges";
import { checkoutProjectVersionFx } from "~/project-version/fx/checkoutProjectVersionFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";

const minimumDurationMs = 1_000;
const completedFrameDurationMs = 240;

export namespace VersionRestoreCommandAtom {
	export interface Command {
		readonly confirmDiscardCurrentChanges: boolean;
		readonly isNavigationPendingFn: () => boolean;
		readonly onFailureFn: (cause: unknown) => void;
		readonly subject: string;
		readonly versionId: string;
	}

	export type State =
		| {
				readonly kind: "idle";
		  }
		| {
				readonly completed: boolean;
				readonly durationMs: number;
				readonly kind: "restoring";
				readonly subject: string;
		  };
}

/** Owns one admitted restore and its complete Action presentation per editor project. */
export const VersionRestoreCommandAtom = RendererRuntime.runSync(
	Effect.gen(function* () {
		const repository = yield* ProjectRepository;
		const writeAdmission = yield* ProjectWriteAdmission;
		const unsavedChanges = yield* EditorUnsavedChanges;
		return Atom.family((projectId: string) => {
			const stateAtom = Atom.make<VersionRestoreCommandAtom.State>({
				kind: "idle",
			}).pipe(Atom.setIdleTTL(0));
			const runnerAtom = Atom.fn(
				(command: VersionRestoreCommandAtom.Command) =>
					Effect.gen(function* () {
						const startedAtMs = yield* Clock.currentTimeMillis;
						const exit = yield* Effect.exit(
							checkoutProjectVersionFx({
								confirmDiscardCurrentChanges: command.confirmDiscardCurrentChanges,
								isNavigationPendingFn: command.isNavigationPendingFn,
								projectId,
								versionId: command.versionId,
							}).pipe(
								Effect.provideService(ProjectRepository, repository),
								Effect.provideService(ProjectWriteAdmission, writeAdmission),
								Effect.provideService(EditorUnsavedChanges, unsavedChanges),
							),
						);
						if (Exit.isFailure(exit)) {
							yield* Atom.set(stateAtom, {
								kind: "idle",
							});
							if (Cause.hasInterruptsOnly(exit.cause))
								return yield* Effect.failCause(exit.cause);
							yield* Effect.sync(() => command.onFailureFn(Cause.squash(exit.cause)));
							return;
						}
						const completedAtMs = yield* Clock.currentTimeMillis;
						yield* Effect.sleep(
							Duration.millis(
								Math.max(0, minimumDurationMs - (completedAtMs - startedAtMs)),
							),
						);
						yield* Atom.set(stateAtom, {
							completed: true,
							durationMs: minimumDurationMs,
							kind: "restoring",
							subject: command.subject,
						});
						yield* Effect.sleep(Duration.millis(completedFrameDurationMs));
						yield* Atom.set(stateAtom, {
							kind: "idle",
						});
					}),
				{
					concurrent: false,
				},
			).pipe(Atom.setIdleTTL(0));

			return Atom.writable(
				(get) => {
					get(runnerAtom);
					return get(stateAtom);
				},
				(context, command: VersionRestoreCommandAtom.Command) => {
					if (context.get(stateAtom).kind === "restoring") return;
					context.set(stateAtom, {
						completed: false,
						durationMs: minimumDurationMs,
						kind: "restoring",
						subject: command.subject,
					});
					context.set(runnerAtom, command);
				},
			).pipe(Atom.setIdleTTL(0));
		});
	}),
);
