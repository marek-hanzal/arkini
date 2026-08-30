import { Cause, Clock, Duration, Effect, Exit } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectRepository } from "~/project-authoring/repository/EditorProjectRepository";
import { EditorUnsavedChanges } from "~/authoring-session/EditorUnsavedChanges";
import { checkoutEditorProjectVersionFx } from "~/project-version/workspace/checkoutEditorProjectVersionFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";

const minimumDurationMs = 1_000;
const completedFrameDurationMs = 240;

export namespace EditorVersionRestoreCommandAtom {
	export interface Command {
		readonly confirmDiscardCurrentChanges: boolean;
		readonly onFailure: (cause: unknown) => void;
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
export const EditorVersionRestoreCommandAtom = RendererRuntime.runSync(
	Effect.gen(function* () {
		const repository = yield* EditorProjectRepository;
		const unsavedChanges = yield* EditorUnsavedChanges;
		return Atom.family((projectId: string) => {
			const stateAtom = Atom.make<EditorVersionRestoreCommandAtom.State>({
				kind: "idle",
			}).pipe(Atom.setIdleTTL(0));
			const runnerAtom = Atom.fn(
				(command: EditorVersionRestoreCommandAtom.Command) =>
					Effect.gen(function* () {
						const startedAtMs = yield* Clock.currentTimeMillis;
						const exit = yield* Effect.exit(
							checkoutEditorProjectVersionFx({
								confirmDiscardCurrentChanges: command.confirmDiscardCurrentChanges,
								projectId,
								versionId: command.versionId,
							}).pipe(
								Effect.provideService(EditorProjectRepository, repository),
								Effect.provideService(EditorUnsavedChanges, unsavedChanges),
							),
						);
						if (Exit.isFailure(exit)) {
							yield* Atom.set(stateAtom, {
								kind: "idle",
							});
							if (Cause.hasInterruptsOnly(exit.cause))
								return yield* Effect.failCause(exit.cause);
							yield* Effect.sync(() => command.onFailure(Cause.squash(exit.cause)));
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
				(context, command: EditorVersionRestoreCommandAtom.Command) => {
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
