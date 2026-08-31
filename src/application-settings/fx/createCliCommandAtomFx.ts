import { Cause, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { readExactCauseFailureFn } from "~/application-diagnostics/fn/readExactCauseFailureFn";

type CliCommand = "read" | "install" | "replace" | "uninstall";

type CliState<Status> =
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

type CliStatus =
	| {
			readonly type: "installed" | "not-installed" | "repairable" | "unavailable";
	  }
	| {
			readonly type: "conflict";
			readonly replaceable: boolean;
	  };

const admitsMutationFn = (command: Exclude<CliCommand, "read">, status: CliStatus) =>
	command === "install"
		? status.type === "not-installed" || status.type === "repairable"
		: command === "replace"
			? status.type === "conflict" && status.replaceable
			: status.type === "installed" || status.type === "repairable";

interface CreateCliCommandAtomFxProps<Status extends CliStatus> {
	readonly readFx: () => Effect.Effect<Status, unknown>;
	readonly installFx: () => Effect.Effect<Status, unknown>;
	readonly replaceFx: () => Effect.Effect<Status, unknown>;
	readonly uninstallFx: () => Effect.Effect<Status, unknown>;
}

/** Builds one Settings-owned command authority for a CLI filesystem capability. */
export const createCliCommandAtomFx = Effect.fn("createCliCommandAtomFx")(
	<Status extends CliStatus>({
		readFx,
		installFx,
		replaceFx,
		uninstallFx,
	}: CreateCliCommandAtomFxProps<Status>) =>
		Effect.sync(() => {
			const stateAtom = Atom.make<CliState<Status>>({
				kind: "uninitialized",
			}).pipe(Atom.keepAlive);
			const runnerAtom = Atom.fn(
				(command: CliCommand, get) =>
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
						const exactFailure = readExactCauseFailureFn(result.cause);
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
				(context, command: CliCommand) => {
					const state = context.get(stateAtom);
					if (command === "read") {
						if (state.kind !== "uninitialized" && state.kind !== "error") return;
						if (state.kind === "error" && state.status !== undefined) return;
						context.set(stateAtom, {
							kind: "loading",
						});
					} else {
						if (state.kind !== "ready" && state.kind !== "error") return;
						if (state.status === undefined || !admitsMutationFn(command, state.status))
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
