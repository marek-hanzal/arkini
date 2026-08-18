import { Cause, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { checkEditorMcpPortFx } from "~/bridge/editor-mcp/checkEditorMcpPortFx";
import { parseEditorMcpPortFx } from "~/bridge/editor-mcp/parseEditorMcpPortFx";
import { readEditorMcpPortFx } from "~/bridge/editor-mcp/readEditorMcpPortFx";
import { writeEditorMcpPortFx } from "~/bridge/editor-mcp/writeEditorMcpPortFx";
import { readExactCauseFailure } from "~/bridge/game/readExactCauseFailure";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

export namespace SettingsMcpCommandAtom {
	export type Command =
		| {
				readonly action: "read";
		  }
		| {
				readonly action: "check";
				readonly rawPort: string;
		  };

	export type State =
		| {
				readonly kind: "uninitialized" | "loading";
		  }
		| {
				readonly kind: "idle" | "checking" | "available" | "active";
				readonly port: string;
		  }
		| {
				readonly kind: "error";
				readonly port?: string;
				readonly message: string;
		  };
}

type SettingsMcpRunnerCommand =
	| Extract<
			SettingsMcpCommandAtom.Command,
			{
				readonly action: "read";
			}
	  >
	| {
			readonly action: "check";
			readonly port: Exclude<parseEditorMcpPortFx.Result, undefined>;
			readonly rawPort: string;
	  };

const SettingsMcpCommandStateAtom = Atom.make<SettingsMcpCommandAtom.State>({
	kind: "uninitialized",
}).pipe(Atom.keepAlive);

const failureMessage = (cause: Cause.Cause<unknown>) => {
	const failure = readExactCauseFailure(cause);
	const value = Option.isSome(failure) ? failure.value : cause;
	return value instanceof Error ? value.message : String(value);
};

const SettingsMcpCommandRunnerAtom = Atom.fn(
	(command: SettingsMcpRunnerCommand) =>
		Effect.gen(function* () {
			const result = yield* Effect.exit(
				Effect.gen(function* () {
					if (command.action === "read") {
						const port = yield* readEditorMcpPortFx();
						return {
							kind: "idle" as const,
							port: String(port),
						};
					}

					const availability = yield* checkEditorMcpPortFx(command.port);
					if (availability.type === "unavailable") {
						return {
							kind: "error" as const,
							port: command.rawPort,
							message: availability.message,
						};
					}

					yield* writeEditorMcpPortFx(command.port);
					return {
						kind:
							availability.type === "active"
								? ("active" as const)
								: ("available" as const),
						port: command.rawPort,
					};
				}),
			);

			if (Exit.isFailure(result)) {
				if (Cause.hasInterruptsOnly(result.cause)) {
					yield* Effect.failCause(result.cause);
				}
				yield* Atom.set(SettingsMcpCommandStateAtom, {
					kind: "error",
					...(command.action === "check"
						? {
								port: command.rawPort,
							}
						: {}),
					message: failureMessage(result.cause),
				});
				return;
			}
			yield* Atom.set(SettingsMcpCommandStateAtom, result.value);
		}),
	{
		concurrent: false,
	},
).pipe(Atom.keepAlive);

/** Owns MCP port read/check/write admission and settlement across Settings remounts. */
export const SettingsMcpCommandAtom = Atom.writable(
	(get) => get(SettingsMcpCommandStateAtom),
	(context, command: SettingsMcpCommandAtom.Command) => {
		const state = context.get(SettingsMcpCommandStateAtom);
		if (command.action === "read") {
			if (state.kind !== "uninitialized") return;
			context.set(SettingsMcpCommandStateAtom, {
				kind: "loading",
			});
		} else {
			if (state.kind === "checking") return;
			const port = RendererRuntime.runSync(parseEditorMcpPortFx(command.rawPort));
			if (port === undefined) {
				context.set(SettingsMcpCommandStateAtom, {
					kind: "error",
					port: command.rawPort,
					message: "Use a port from 1024 to 65535.",
				});
				return;
			}
			context.set(SettingsMcpCommandStateAtom, {
				kind: "checking",
				port: command.rawPort,
			});
			context.set(SettingsMcpCommandRunnerAtom, {
				...command,
				port,
			});
			return;
		}
		context.set(SettingsMcpCommandRunnerAtom, command);
	},
).pipe(Atom.keepAlive);
