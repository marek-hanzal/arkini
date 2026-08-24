import { Cause, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import {
	installCliFx,
	readCliInstallationStatusFx,
	type CliInstallationStatus,
	uninstallCliFx,
} from "~/bridge/cli/CliInstallation";
import { readExactCauseFailureFx } from "~/bridge/game/readExactCauseFailureFx";

export namespace SettingsCliCommandAtom {
	export type Command = "read" | "install" | "uninstall";
	export type State =
		| {
				readonly kind: "uninitialized" | "loading";
		  }
		| {
				readonly kind: "ready";
				readonly status: CliInstallationStatus;
		  }
		| {
				readonly kind: "pending";
				readonly action: "install" | "uninstall";
				readonly status: CliInstallationStatus;
		  }
		| {
				readonly kind: "error";
				readonly message: string;
				readonly status?: CliInstallationStatus;
		  };
}

const stateAtom = Atom.make<SettingsCliCommandAtom.State>({
	kind: "uninitialized",
}).pipe(Atom.keepAlive);

const runnerAtom = Atom.fn(
	(command: SettingsCliCommandAtom.Command, get) =>
		Effect.gen(function* () {
			const priorState = get(stateAtom);
			const result = yield* Effect.exit(
				command === "read"
					? readCliInstallationStatusFx()
					: command === "install"
						? installCliFx()
						: uninstallCliFx(),
			);
			if (Exit.isSuccess(result)) {
				yield* Atom.set(stateAtom, {
					kind: "ready",
					status: result.value,
				});
				return;
			}
			if (Cause.hasInterruptsOnly(result.cause)) return yield* Effect.failCause(result.cause);
			const exactFailure = yield* readExactCauseFailureFx(result.cause);
			const failure = Option.isSome(exactFailure) ? exactFailure.value : result.cause;
			yield* Atom.set(stateAtom, {
				kind: "error",
				message: failure instanceof Error ? failure.message : String(failure),
				...(priorState.kind === "pending"
					? {
							status: priorState.status,
						}
					: {}),
			});
		}),
	{
		concurrent: false,
	},
).pipe(Atom.keepAlive);

/** Owns the Settings read/install/uninstall sequence for the packaged CLI command. */
export const SettingsCliCommandAtom = Atom.writable(
	(get) => get(stateAtom),
	(context, command: SettingsCliCommandAtom.Command) => {
		const state = context.get(stateAtom);
		if (command === "read") {
			if (state.kind !== "uninitialized" && state.kind !== "error") return;
			if (state.kind === "error" && state.status !== undefined) return;
			context.set(stateAtom, {
				kind: "loading",
			});
		} else {
			if (state.kind !== "ready" && state.kind !== "error") return;
			if (state.status === undefined) return;
			if (
				(command === "install" &&
					state.status.type !== "not-installed" &&
					state.status.type !== "repairable") ||
				(command === "uninstall" &&
					state.status.type !== "installed" &&
					state.status.type !== "repairable")
			)
				return;
			context.set(stateAtom, {
				kind: "pending",
				action: command,
				status: state.status,
			});
		}
		context.set(runnerAtom, command);
	},
).pipe(Atom.keepAlive);
