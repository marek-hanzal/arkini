import { Cause, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { createFreshProjectFx } from "~/project-authoring/fx/createFreshProjectFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import {
	type ProjectDescriptor,
	ProjectDescriptorSchema,
} from "~/project-authoring/schema/ProjectDescriptorSchema";
import { invokeProjectTransportFx } from "~/project-authoring/fx/invokeProjectTransportFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { readExactCauseFailureFn } from "~/application-diagnostics/fn/readExactCauseFailureFn";
import { importEditorArkpackFileFx } from "~/project-authoring/fx/importEditorArkpackFileFx";

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
				readonly projectId: string;
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
				readonly project: ProjectDescriptor;
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

const editorProjectRepository = RendererRuntime.runSync(ProjectRepository);

const publishCommandFailureFx = (cause: Cause.Cause<unknown>) =>
	Cause.hasInterruptsOnly(cause)
		? Effect.failCause(cause)
		: Atom.set(EditorWelcomeCommandStateAtom, {
				kind: "error",
				error: Option.getOrElse(readExactCauseFailureFn(cause), () => cause),
			});

const EditorWelcomeCommandRunnerAtom = Atom.fn(
	(command: EditorWelcomeCommandAtom.Command) =>
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
					editorProjectRepository.deleteProjectFx(command.projectId),
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
					invokeProjectTransportFx({
						callFn: () => window.arkini.editor.openProjectDirectoryFn(command.root),
						operation: "open-project-directory",
						parseFn: () => undefined,
						requestMessage: "The invalid Editor project folder request failed.",
						responseMessage: "The invalid Editor project folder response is invalid.",
					}),
				);
				if (Exit.isFailure(result)) return yield* publishCommandFailureFx(result.cause);
				yield* Atom.set(EditorWelcomeCommandStateAtom, {
					kind: "idle",
				});
				return;
			}
			const operation =
				command.action === "create"
					? createFreshProjectFx(command.projectId).pipe(
							Effect.provideService(ProjectRepository, editorProjectRepository),
						)
					: command.action === "import-arkpack"
						? importEditorArkpackFileFx({
								file: command.file,
							}).pipe(
								Effect.provideService(ProjectRepository, editorProjectRepository),
							)
						: invokeProjectTransportFx({
								callFn: () => window.arkini.editor.importJsonDirectoryFn(),
								operation: "import-json-directory",
								parseFn: (value) =>
									value === null ? null : ProjectDescriptorSchema.parse(value),
								requestMessage: "The editor JSON import request failed.",
								responseMessage: "The editor JSON import response is invalid.",
							});
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

const isCommandActiveFn = (state: EditorWelcomeCommandAtom.State) =>
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
		if (isCommandActiveFn(state)) return;
		context.set(EditorWelcomeCommandStateAtom, {
			kind: "pending",
			action: input.action,
		});
		context.set(EditorWelcomeCommandRunnerAtom, input);
	},
).pipe(Atom.keepAlive);
