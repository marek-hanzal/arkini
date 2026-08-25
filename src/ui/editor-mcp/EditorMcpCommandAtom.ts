import { Cause, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { match } from "ts-pattern";

import type { EditorMcpCommandSchema } from "../../../electron/contract/editor/EditorMcpCommandSchema";
import type { EditorMcpConfigurationSchema } from "../../../electron/contract/editor/EditorMcpConfigurationSchema";
import type { EditorMcpOverviewSchema } from "../../../electron/contract/editor/EditorMcpOverviewSchema";
import { configureEditorMcpFx } from "~/bridge/editor-mcp/configureEditorMcpFx";
import { executeEditorMcpCommandFx } from "~/bridge/editor-mcp/executeEditorMcpCommandFx";
import { readEditorMcpOverviewFx } from "~/bridge/editor-mcp/readEditorMcpOverviewFx";
import { readExactCauseFailureFx } from "~/bridge/game/readExactCauseFailureFx";

export namespace EditorMcpCommandAtom {
	export type Action = EditorMcpCommandSchema.Type | "configure" | "read";

	export type Command =
		| {
				readonly type: "read";
		  }
		| {
				readonly type: "synchronize";
				readonly overview: EditorMcpOverviewSchema.Type;
		  }
		| {
				readonly type: "configure";
				readonly configuration: EditorMcpConfigurationSchema.Type;
		  }
		| {
				readonly type: "execute";
				readonly command: EditorMcpCommandSchema.Type;
		  }
		| {
				readonly type: "dismiss-secret";
		  };

	export type State =
		| {
				readonly kind: "uninitialized" | "loading";
		  }
		| {
				readonly kind: "ready";
				readonly overview: EditorMcpOverviewSchema.Type;
				readonly secret?: string;
		  }
		| {
				readonly kind: "pending";
				readonly action: Action;
				readonly overview: EditorMcpOverviewSchema.Type;
				readonly secret?: string;
		  }
		| {
				readonly kind: "error";
				readonly message: string;
				readonly overview?: EditorMcpOverviewSchema.Type;
				readonly secret?: string;
		  };
}

type RunnerCommand = Exclude<
	EditorMcpCommandAtom.Command,
	{
		readonly type: "synchronize" | "dismiss-secret";
	}
>;

const StateAtom = Atom.make<EditorMcpCommandAtom.State>({
	kind: "uninitialized",
}).pipe(Atom.keepAlive);

const RunnerAtom = Atom.fn(
	(command: RunnerCommand) =>
		Effect.gen(function* () {
			const operation = match(command)
				.with(
					{
						type: "read",
					},
					() =>
						readEditorMcpOverviewFx.pipe(
							Effect.map((overview) => ({
								overview,
							})),
						),
				)
				.with(
					{
						type: "configure",
					},
					({ configuration }) =>
						configureEditorMcpFx(configuration).pipe(
							Effect.map((overview) => ({
								overview,
							})),
						),
				)
				.with(
					{
						type: "execute",
					},
					({ command: requestedCommand }) => executeEditorMcpCommandFx(requestedCommand),
				)
				.exhaustive();
			const result = yield* Effect.exit(operation);
			if (Exit.isSuccess(result)) {
				const current = yield* Atom.get(StateAtom);
				const previousSecret = "secret" in current ? current.secret : undefined;
				const returnedSecret =
					"secret" in result.value && typeof result.value.secret === "string"
						? result.value.secret
						: undefined;
				const nextSecret = returnedSecret ?? previousSecret;
				yield* Atom.set(StateAtom, {
					kind: "ready",
					...result.value,
					...(nextSecret === undefined
						? {}
						: {
								secret: nextSecret,
							}),
				});
				return;
			}
			if (Cause.hasInterruptsOnly(result.cause)) return yield* Effect.failCause(result.cause);
			const exact = yield* readExactCauseFailureFx(result.cause);
			const failure = Option.isSome(exact) ? exact.value : result.cause;
			const current = yield* Atom.get(StateAtom);
			yield* Atom.set(StateAtom, {
				kind: "error",
				...(current.kind === "ready" ||
				current.kind === "pending" ||
				current.kind === "error"
					? {
							overview: current.overview,
							...(current.secret === undefined
								? {}
								: {
										secret: current.secret,
									}),
						}
					: {}),
				message: failure instanceof Error ? failure.message : String(failure),
			});
		}),
	{
		concurrent: false,
	},
).pipe(Atom.keepAlive);

/** Owns MCP configuration and lifecycle command settlement across its routed tabs. */
export const EditorMcpCommandAtom = Atom.writable(
	(get) => get(StateAtom),
	(context, command: EditorMcpCommandAtom.Command) => {
		const state = context.get(StateAtom);
		if (command.type === "synchronize") {
			if (state.kind === "pending") {
				context.set(StateAtom, {
					...state,
					overview: command.overview,
				});
				return;
			}
			context.set(StateAtom, {
				kind: "ready",
				overview: command.overview,
				...(state.kind === "ready" || state.kind === "error"
					? state.secret === undefined
						? {}
						: {
								secret: state.secret,
							}
					: {}),
			});
			return;
		}
		if (command.type === "dismiss-secret") {
			if (state.kind === "ready")
				context.set(StateAtom, {
					kind: "ready",
					overview: state.overview,
				});
			return;
		}
		if (state.kind === "loading" || state.kind === "pending") return;
		if (command.type === "read") {
			const overview = "overview" in state ? state.overview : undefined;
			context.set(
				StateAtom,
				overview === undefined
					? {
							kind: "loading",
						}
					: {
							kind: "pending",
							action: "read",
							overview,
							...("secret" in state && state.secret !== undefined
								? {
										secret: state.secret,
									}
								: {}),
						},
			);
		} else {
			if (state.kind === "uninitialized") return;
			const overview = "overview" in state ? state.overview : undefined;
			if (overview === undefined) return;
			context.set(StateAtom, {
				kind: "pending",
				action: command.type === "configure" ? "configure" : command.command,
				overview,
				...("secret" in state && state.secret !== undefined
					? {
							secret: state.secret,
						}
					: {}),
			});
		}
		context.set(RunnerAtom, command);
	},
).pipe(Atom.keepAlive);
