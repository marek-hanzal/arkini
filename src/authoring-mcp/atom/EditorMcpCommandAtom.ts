import { Cause, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { match } from "ts-pattern";

import { EditorMcpCommandResultSchema } from "../../../electron/contract/editor/EditorMcpCommandResultSchema";
import { EditorMcpCommandSchema } from "../../../electron/contract/editor/EditorMcpCommandSchema";
import { EditorMcpConfigurationSchema } from "../../../electron/contract/editor/EditorMcpConfigurationSchema";
import { EditorMcpOverviewSchema } from "../../../electron/contract/editor/EditorMcpOverviewSchema";
import { readExactCauseFailureFn } from "~/application-diagnostics/fn/readExactCauseFailureFn";

type EditorMcpCommand = EditorMcpCommandSchema.Type;
type EditorMcpConfiguration = EditorMcpConfigurationSchema.Type;
type EditorMcpOverview = EditorMcpOverviewSchema.Type;

const readEditorMcpOverviewFx = Effect.tryPromise({
	try: async () => EditorMcpOverviewSchema.parse(await window.arkini.editorMcp.readOverview()),
	catch: (cause) => cause,
});

const configureEditorMcpFx = Effect.fn("configureEditorMcpFx")((candidate: unknown) =>
	Effect.try({
		try: () => EditorMcpConfigurationSchema.parse(candidate),
		catch: (cause) => cause,
	}).pipe(
		Effect.flatMap((configuration) =>
			Effect.tryPromise({
				try: async () =>
					EditorMcpOverviewSchema.parse(
						await window.arkini.editorMcp.configure(configuration),
					),
				catch: (cause) => cause,
			}),
		),
	),
);

const executeEditorMcpCommandFx = Effect.fn("executeEditorMcpCommandFx")((candidate: unknown) =>
	Effect.try({
		try: () => EditorMcpCommandSchema.parse(candidate),
		catch: (cause) => cause,
	}).pipe(
		Effect.flatMap((command) =>
			Effect.tryPromise({
				try: async () =>
					EditorMcpCommandResultSchema.parse(
						await window.arkini.editorMcp.command(command),
					),
				catch: (cause) => cause,
			}),
		),
	),
);

export namespace EditorMcpCommandAtom {
	export type Action = EditorMcpCommand | "configure" | "read";

	export type Command =
		| {
				readonly type: "read";
		  }
		| {
				readonly type: "synchronize";
				readonly overview: EditorMcpOverview;
		  }
		| {
				readonly type: "configure";
				readonly configuration: EditorMcpConfiguration;
		  }
		| {
				readonly type: "execute";
				readonly command: EditorMcpCommand;
		  };

	export type State =
		| {
				readonly kind: "uninitialized" | "loading";
		  }
		| {
				readonly kind: "ready";
				readonly overview: EditorMcpOverview;
		  }
		| {
				readonly kind: "pending";
				readonly action: Action;
				readonly overview: EditorMcpOverview;
		  }
		| {
				readonly kind: "error";
				readonly message: string;
				readonly overview?: EditorMcpOverview;
		  };
}

type RunnerCommand = Exclude<
	EditorMcpCommandAtom.Command,
	{
		readonly type: "synchronize";
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
				yield* Atom.set(StateAtom, {
					kind: "ready",
					...result.value,
				});
				return;
			}
			if (Cause.hasInterruptsOnly(result.cause)) return yield* Effect.failCause(result.cause);
			const exact = readExactCauseFailureFn(result.cause);
			const failure = Option.isSome(exact) ? exact.value : result.cause;
			const current = yield* Atom.get(StateAtom);
			yield* Atom.set(StateAtom, {
				kind: "error",
				...(current.kind === "ready" ||
				current.kind === "pending" ||
				current.kind === "error"
					? {
							overview: current.overview,
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
			});
		}
		context.set(RunnerAtom, command);
	},
).pipe(Atom.keepAlive);
