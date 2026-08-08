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
				readonly navigateFx: (
					project: EditorProjectDescriptor,
				) => Effect.Effect<void, unknown>;
		  }
		| {
				readonly action: "exit";
				readonly navigateFx: Effect.Effect<void, unknown>;
		  }
		| {
				readonly action: "import";
				readonly file: File;
				readonly navigateFx: (
					project: EditorProjectDescriptor,
				) => Effect.Effect<void, unknown>;
		  };

	export type State =
		| {
				readonly kind: "idle";
		  }
		| {
				readonly kind: "pending";
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
			const operation =
				command.action === "exit"
					? command.navigateFx
					: command.action === "create"
						? get
								.setResult(createFreshEditorProjectAtom, undefined)
								.pipe(Effect.flatMap(command.navigateFx))
						: get
								.setResult(importEditorArkpackFileAtom, command.file)
								.pipe(Effect.flatMap(command.navigateFx));
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
				kind: "idle",
			});
		}),
	{
		concurrent: true,
	},
).pipe(Atom.keepAlive);

/** Owns one synchronous editor-welcome command across React remounts. */
export const EditorWelcomeCommandAtom = Atom.writable(
	(get) => get(EditorWelcomeCommandStateAtom),
	(context, command: EditorWelcomeCommandAtom.Command) => {
		if (context.get(EditorWelcomeCommandStateAtom).kind === "pending") return;
		context.set(EditorWelcomeCommandStateAtom, {
			kind: "pending",
			action: command.action,
		});
		context.set(EditorWelcomeCommandRunnerAtom, command);
	},
).pipe(Atom.keepAlive);
