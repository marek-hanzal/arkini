import { Cause, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { readExactCauseFailureFx } from "~/bridge/game/readExactCauseFailureFx";

export type SettingsCliCapabilityCommand = "read" | "install" | "replace" | "uninstall";

export type SettingsCliCapabilityState<Status> =
	| {
			readonly kind: "uninitialized" | "loading";
	  }
	| {
			readonly kind: "ready";
			readonly status: Status;
	  }
	| {
			readonly kind: "pending";
			readonly action: "install" | "replace" | "uninstall";
			readonly status: Status;
	  }
	| {
			readonly kind: "error";
			readonly message: string;
			readonly status?: Status;
	  };

type SettingsCliCapabilityStatus =
	| {
			readonly type: "installed" | "not-installed" | "repairable" | "unavailable";
	  }
	| {
			readonly type: "conflict";
			readonly replaceable: boolean;
	  };

const admitsMutation = (
	command: Exclude<SettingsCliCapabilityCommand, "read">,
	status: SettingsCliCapabilityStatus,
) =>
	command === "install"
		? status.type === "not-installed" || status.type === "repairable"
		: command === "replace"
			? status.type === "conflict" && status.replaceable
			: status.type === "installed" || status.type === "repairable";

export namespace createSettingsCliCapabilityCommandAtomFx {
	export interface Props<Status extends SettingsCliCapabilityStatus> {
		readonly readFx: () => Effect.Effect<Status, unknown>;
		readonly installFx: () => Effect.Effect<Status, unknown>;
		readonly replaceFx: () => Effect.Effect<Status, unknown>;
		readonly uninstallFx: () => Effect.Effect<Status, unknown>;
	}
}

/** Builds one Settings-owned command authority for a CLI filesystem capability. */
export const createSettingsCliCapabilityCommandAtomFx = Effect.fn(
	"createSettingsCliCapabilityCommandAtomFx",
)(
	<Status extends SettingsCliCapabilityStatus>({
		readFx,
		installFx,
		replaceFx,
		uninstallFx,
	}: createSettingsCliCapabilityCommandAtomFx.Props<Status>) =>
		Effect.sync(() => {
			const stateAtom = Atom.make<SettingsCliCapabilityState<Status>>({
				kind: "uninitialized",
			}).pipe(Atom.keepAlive);
			const runnerAtom = Atom.fn(
				(command: SettingsCliCapabilityCommand, get) =>
					Effect.gen(function* () {
						const priorState = get(stateAtom);
						const result = yield* Effect.exit(
							command === "read"
								? readFx()
								: command === "install"
									? installFx()
									: command === "replace"
										? replaceFx()
										: uninstallFx(),
						);
						if (Exit.isSuccess(result)) {
							yield* Atom.set(stateAtom, {
								kind: "ready",
								status: result.value,
							});
							return;
						}
						if (Cause.hasInterruptsOnly(result.cause)) {
							return yield* Effect.failCause(result.cause);
						}
						const exactFailure = yield* readExactCauseFailureFx(result.cause);
						const failure = Option.isSome(exactFailure)
							? exactFailure.value
							: result.cause;
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

			return Atom.writable(
				(get) => get(stateAtom),
				(context, command: SettingsCliCapabilityCommand) => {
					const state = context.get(stateAtom);
					if (command === "read") {
						if (state.kind !== "uninitialized" && state.kind !== "error") return;
						if (state.kind === "error" && state.status !== undefined) return;
						context.set(stateAtom, {
							kind: "loading",
						});
					} else {
						if (state.kind !== "ready" && state.kind !== "error") return;
						if (state.status === undefined || !admitsMutation(command, state.status))
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
		}),
);
