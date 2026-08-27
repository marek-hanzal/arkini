import { Cause, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { importEditorArkpackFileAtom } from "~/bridge/arkpack/editor/importEditorArkpackFileAtom";
import { createFreshEditorProjectAtom } from "~/bridge/editor/createFreshEditorProjectAtom";
import { deleteEditorProjectAtom } from "~/bridge/editor/deleteEditorProjectAtom";
import { importEditorJsonDirectoryAtom } from "~/bridge/editor/importEditorJsonDirectoryAtom";
import { openInvalidEditorProjectDirectoryFx } from "~/bridge/editor/openInvalidEditorProjectDirectoryFx";
import type { EditorProjectDescriptor } from "~/bridge/editor/EditorProjectDescriptor";
import { readExactCauseFailureFx } from "~/bridge/game/readExactCauseFailureFx";

export namespace EditorWelcomeCommandAtom {
	export type Action =
		| "create"
		| "delete-project"
		| "exit"
		| "import-arkpack"
		| "import-json"
		| "open-project-folder";

	export type Command =
		| {
				readonly action: "create";
		  }
		| {
				readonly action: "delete-project";
				readonly projectId: string;
		  }
		| {
				readonly action: "exit";
		  }
		| {
				readonly action: "import-arkpack";
				readonly file: File;
		  }
		| {
				readonly action: "import-json";
		  }
		| {
				readonly action: "open-project-folder";
				readonly root: string;
		  };

	export type NavigationEvent =
		| {
				readonly action: "navigation-started";
		  }
		| {
				readonly action: "navigation-complete";
		  }
		| {
				readonly action: "navigation-failed";
				readonly error: unknown;
		  };

	export type Input = Command | NavigationEvent;

	export type ReadyState =
		| {
				readonly kind: "ready";
				readonly action: "create" | "import-arkpack" | "import-json";
				readonly project: EditorProjectDescriptor;
		  }
		| {
				readonly kind: "ready";
				readonly action: "exit";
		  }
		| {
				readonly kind: "ready";
				readonly action: "delete-project";
				readonly projectId: string;
		  };

	export type State =
		| {
				readonly kind: "idle";
		  }
		| {
				readonly kind: "pending";
				readonly action: Action;
		  }
		| ReadyState
		| {
				readonly kind: "navigating";
				readonly action: Action;
		  }
		| {
				readonly kind: "error";
				readonly error: unknown;
		  };
}

const EditorWelcomeCommandStateAtom = Atom.make<EditorWelcomeCommandAtom.State>({
	kind: "idle",
}).pipe(Atom.keepAlive);

const publishCommandFailureFx = (cause: Cause.Cause<unknown>) =>
	Cause.hasInterruptsOnly(cause)
		? Effect.failCause(cause)
		: readExactCauseFailureFx(cause).pipe(
				Effect.flatMap((failure) =>
					Atom.set(EditorWelcomeCommandStateAtom, {
						kind: "error",
						error: Option.isSome(failure) ? failure.value : cause,
					}),
				),
			);

const EditorWelcomeCommandRunnerAtom = Atom.fn(
	(command: EditorWelcomeCommandAtom.Command, get) =>
		Effect.gen(function* () {
			if (command.action === "exit") {
				yield* Atom.set(EditorWelcomeCommandStateAtom, {
					kind: "ready",
					action: "exit",
				});
				return;
			}
			if (command.action === "delete-project") {
				const result = yield* Effect.exit(
					get.setResult(deleteEditorProjectAtom, command.projectId),
				);
				if (Exit.isFailure(result)) return yield* publishCommandFailureFx(result.cause);
				yield* Atom.set(EditorWelcomeCommandStateAtom, {
					kind: "ready",
					action: "delete-project",
					projectId: command.projectId,
				});
				return;
			}
			if (command.action === "open-project-folder") {
				const result = yield* Effect.exit(
					openInvalidEditorProjectDirectoryFx(command.root),
				);
				if (Exit.isFailure(result)) return yield* publishCommandFailureFx(result.cause);
				yield* Atom.set(EditorWelcomeCommandStateAtom, {
					kind: "idle",
				});
				return;
			}
			const operation =
				command.action === "create"
					? get.setResult(createFreshEditorProjectAtom, undefined)
					: command.action === "import-arkpack"
						? get.setResult(importEditorArkpackFileAtom, command.file)
						: get.setResult(importEditorJsonDirectoryAtom, undefined);
			const result = yield* Effect.exit(operation);
			if (Exit.isFailure(result)) return yield* publishCommandFailureFx(result.cause);
			if (result.value === null) {
				yield* Atom.set(EditorWelcomeCommandStateAtom, {
					kind: "idle",
				});
				return;
			}
			yield* Atom.set(EditorWelcomeCommandStateAtom, {
				kind: "ready",
				action: command.action,
				project: result.value,
			});
		}),
	{
		concurrent: true,
	},
).pipe(Atom.keepAlive);

const isCommandActive = (state: EditorWelcomeCommandAtom.State) =>
	state.kind === "pending" || state.kind === "ready" || state.kind === "navigating";

/** Owns one synchronous editor-welcome command across React remounts. */
export const EditorWelcomeCommandAtom = Atom.writable(
	(get) => get(EditorWelcomeCommandStateAtom),
	(context, input: EditorWelcomeCommandAtom.Input) => {
		const state = context.get(EditorWelcomeCommandStateAtom);
		if (input.action === "navigation-started") {
			if (state.kind !== "ready") return;
			context.set(EditorWelcomeCommandStateAtom, {
				kind: "navigating",
				action: state.action,
			});
			return;
		}
		if (input.action === "navigation-complete") {
			if (state.kind !== "navigating") return;
			context.set(EditorWelcomeCommandStateAtom, {
				kind: "idle",
			});
			return;
		}
		if (input.action === "navigation-failed") {
			if (state.kind !== "navigating") return;
			context.set(EditorWelcomeCommandStateAtom, {
				kind: "error",
				error: input.error,
			});
			return;
		}
		if (isCommandActive(state)) return;
		context.set(EditorWelcomeCommandStateAtom, {
			kind: "pending",
			action: input.action,
		});
		context.set(EditorWelcomeCommandRunnerAtom, input);
	},
).pipe(Atom.keepAlive);
