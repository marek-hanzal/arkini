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

export namespace ProjectCatalogCommandAtom {
	export type Action =
		| "create"
		| "dismiss-invalid-project"
		| "delete-project"
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
				readonly action: "import-json";
		  }
		| {
				readonly action: "open-project-folder" | "dismiss-invalid-project";
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
				readonly action: "dismiss-invalid-project";
				readonly root: string;
		  }
		| {
				readonly kind: "ready";
				readonly action: "create" | "import-json";
				readonly project: ProjectDescriptor;
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

const ProjectCatalogCommandStateAtom = Atom.make<ProjectCatalogCommandAtom.State>({
	kind: "idle",
}).pipe(Atom.keepAlive);

const editorProjectRepository = RendererRuntime.runSync(ProjectRepository);

const publishCommandFailureFx = (cause: Cause.Cause<unknown>) =>
	Cause.hasInterruptsOnly(cause)
		? Effect.failCause(cause)
		: Atom.set(ProjectCatalogCommandStateAtom, {
				kind: "error",
				error: Option.getOrElse(readExactCauseFailureFn(cause), () => cause),
			});

const ProjectCatalogCommandRunnerAtom = Atom.fn(
	(command: ProjectCatalogCommandAtom.Command) =>
		Effect.gen(function* () {
			if (command.action === "delete-project") {
				const result = yield* Effect.exit(
					editorProjectRepository.deleteProjectFx(command.projectId),
				);
				if (Exit.isFailure(result)) return yield* publishCommandFailureFx(result.cause);
				yield* Atom.set(ProjectCatalogCommandStateAtom, {
					kind: "ready",
					action: "delete-project",
					projectId: command.projectId,
				});
				return;
			}
			if (command.action === "dismiss-invalid-project") {
				const result = yield* Effect.exit(
					invokeProjectTransportFx({
						callFn: () => window.serakki.editor.dismissInvalidProjectFn(command.root),
						operation: "dismiss-invalid-project",
						parseFn: () => undefined,
						requestMessage:
							"The blocked Editor project could not be removed from Recent.",
						responseMessage: "The Editor project dismissal response is invalid.",
					}),
				);
				if (Exit.isFailure(result)) return yield* publishCommandFailureFx(result.cause);
				yield* Atom.set(ProjectCatalogCommandStateAtom, {
					kind: "ready",
					action: "dismiss-invalid-project",
					root: command.root,
				});
				return;
			}
			if (command.action === "open-project-folder") {
				const result = yield* Effect.exit(
					invokeProjectTransportFx({
						callFn: () => window.serakki.editor.openProjectDirectoryFn(command.root),
						operation: "open-project-directory",
						parseFn: () => undefined,
						requestMessage: "The invalid Editor project folder request failed.",
						responseMessage: "The invalid Editor project folder response is invalid.",
					}),
				);
				if (Exit.isFailure(result)) return yield* publishCommandFailureFx(result.cause);
				yield* Atom.set(ProjectCatalogCommandStateAtom, {
					kind: "idle",
				});
				return;
			}
			const operation =
				command.action === "create"
					? createFreshProjectFx(command.projectId).pipe(
							Effect.provideService(ProjectRepository, editorProjectRepository),
						)
					: invokeProjectTransportFx({
							callFn: () => window.serakki.editor.importJsonDirectoryFn(),
							operation: "import-json-directory",
							parseFn: (value) =>
								value === null ? null : ProjectDescriptorSchema.parse(value),
							requestMessage: "The editor JSON import request failed.",
							responseMessage: "The editor JSON import response is invalid.",
						});
			const result = yield* Effect.exit(operation);
			if (Exit.isFailure(result)) return yield* publishCommandFailureFx(result.cause);
			if (result.value === null) {
				yield* Atom.set(ProjectCatalogCommandStateAtom, {
					kind: "idle",
				});
				return;
			}
			yield* Atom.set(ProjectCatalogCommandStateAtom, {
				kind: "ready",
				action: command.action,
				project: result.value,
			});
		}),
	{
		concurrent: true,
	},
).pipe(Atom.keepAlive);

const isCommandActiveFn = (state: ProjectCatalogCommandAtom.State) =>
	state.kind === "pending" || state.kind === "ready" || state.kind === "navigating";

/** Owns one synchronous project catalog command across React remounts. */
export const ProjectCatalogCommandAtom = Atom.writable(
	(get) => get(ProjectCatalogCommandStateAtom),
	(context, input: ProjectCatalogCommandAtom.Input) => {
		const state = context.get(ProjectCatalogCommandStateAtom);
		if (input.action === "navigation-started") {
			if (state.kind !== "ready") return;
			context.set(ProjectCatalogCommandStateAtom, {
				kind: "navigating",
				action: state.action,
			});
			return;
		}
		if (input.action === "navigation-complete") {
			if (state.kind !== "navigating") return;
			context.set(ProjectCatalogCommandStateAtom, {
				kind: "idle",
			});
			return;
		}
		if (input.action === "navigation-failed") {
			if (state.kind !== "navigating") return;
			context.set(ProjectCatalogCommandStateAtom, {
				kind: "error",
				error: input.error,
			});
			return;
		}
		if (isCommandActiveFn(state)) return;
		context.set(ProjectCatalogCommandStateAtom, {
			kind: "pending",
			action: input.action,
		});
		context.set(ProjectCatalogCommandRunnerAtom, input);
	},
).pipe(Atom.keepAlive);
