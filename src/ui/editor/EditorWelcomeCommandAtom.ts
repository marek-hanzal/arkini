import { Cause, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { importEditorArkpackFileAtom } from "~/bridge/arkpack/editor/importEditorArkpackFileAtom";
import { createFreshEditorProjectAtom } from "~/bridge/editor/createFreshEditorProjectAtom";
import type { EditorProjectDescriptor } from "~/bridge/editor/EditorProjectDescriptor";
import { readExactCauseFailure } from "~/bridge/game/readExactCauseFailure";

export namespace EditorWelcomeCommandAtom {
	export type Action = "create" | "exit" | "import";

	export type Command =
		| {
				readonly action: "create";
		  }
		| {
				readonly action: "exit";
		  }
		| {
				readonly action: "import";
				readonly file: File;
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
				readonly action: "create" | "import";
				readonly project: EditorProjectDescriptor;
		  }
		| {
				readonly kind: "ready";
				readonly action: "exit";
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
			const operation =
				command.action === "create"
					? get.setResult(createFreshEditorProjectAtom, undefined)
					: get.setResult(importEditorArkpackFileAtom, command.file);
			const result = yield* Effect.exit(operation);
			if (Exit.isFailure(result)) {
				if (Cause.hasInterruptsOnly(result.cause)) {
					return yield* Effect.failCause(result.cause);
				}
				const failure = readExactCauseFailure(result.cause);
				yield* Atom.set(EditorWelcomeCommandStateAtom, {
					kind: "error",
					error: Option.isSome(failure) ? failure.value : result.cause,
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
