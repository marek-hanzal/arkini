import { Cause, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { match } from "ts-pattern";

import type { EditorProjectDescriptor } from "~/bridge/editor/EditorProjectDescriptor";
import { importEditorArkpackFileAtom } from "~/bridge/arkpack/editor/importEditorArkpackFileAtom";
import { openEditorDirectoryAtom } from "~/bridge/editor/openEditorDirectoryAtom";
import { readExactCauseFailure } from "~/bridge/game/readExactCauseFailure";

export namespace EditorWelcomeCommandAtom {
	export type Action = "exit" | "import" | "open-directory";

	export type Command =
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
		  }
		| {
				readonly action: "open-directory";
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
			const operation = match(command)
				.with(
					{
						action: "exit",
					},
					({ navigateFx }) => navigateFx,
				)
				.with(
					{
						action: "import",
					},
					({ file, navigateFx }) =>
						get
							.setResult(importEditorArkpackFileAtom, file)
							.pipe(Effect.flatMap(navigateFx)),
				)
				.with(
					{
						action: "open-directory",
					},
					() => get.setResult(openEditorDirectoryAtom, undefined),
				)
				.exhaustive();
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
