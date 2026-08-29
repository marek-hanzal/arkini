import { Cause, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { PlayableGame } from "~/renderer/game/PlayableGame";
import { readExactCauseFailureFn } from "~/renderer/diagnostics/fn/readExactCauseFailureFn";
import type {
	ItemDetailPendingAction,
	RunItemDetailPendingActionProps,
} from "~/ui/item-detail/ItemDetailPendingActionOwner";

export namespace createItemDetailCommandAtom {
	export interface Dependencies {
		readonly game: PlayableGame;
		readonly readOutcomeScope: () => string | undefined;
	}

	export interface State {
		readonly pendingActions: ReadonlyMap<
			string,
			{
				readonly action: ItemDetailPendingAction;
				readonly token: symbol;
			}
		>;
		readonly actionErrors: ReadonlyMap<
			string,
			{
				readonly message: string;
				readonly outcomeScope: string | undefined;
			}
		>;
		readonly fatalCause: Cause.Cause<unknown> | undefined;
	}

	export type Command =
		| RunItemDetailPendingActionProps
		| {
				readonly kind: "scope-changed";
				readonly outcomeScope: string | undefined;
		  };
}

type AdmittedCommand = RunItemDetailPendingActionProps & {
	readonly outcomeScope: string | undefined;
	readonly token: symbol;
};

const initialState = {
	pendingActions: new Map(),
	actionErrors: new Map(),
	fatalCause: undefined,
} as const satisfies createItemDetailCommandAtom.State;

/**
 * Creates the one provider-scoped Item Detail command authority.
 *
 * The writable boundary admits one command per exact key synchronously. The runner
 * owns execution and settlement; modal presentation owns only target/phase state.
 */
export const createItemDetailCommandAtom = ({
	game,
	readOutcomeScope,
}: createItemDetailCommandAtom.Dependencies) => {
	const stateAtom = Atom.make<createItemDetailCommandAtom.State>(initialState).pipe(
		Atom.setIdleTTL(0),
	);
	const runnerAtom = Atom.fn(
		(command: AdmittedCommand) =>
			Effect.yieldNow.pipe(
				Effect.andThen(
					Effect.gen(function* () {
						const exit = yield* Effect.exit(command.run);
						const failure =
							Exit.isFailure(exit) && !Cause.hasInterruptsOnly(exit.cause)
								? readExactCauseFailureFn(exit.cause)
								: Option.none();
						yield* Atom.update(stateAtom, (state) => {
							const pending = state.pendingActions.get(command.key);
							if (pending?.token !== command.token) return state;
							const pendingActions = new Map(state.pendingActions);
							pendingActions.delete(command.key);
							if (Exit.isSuccess(exit) || Cause.hasInterruptsOnly(exit.cause)) {
								return {
									...state,
									pendingActions,
								};
							}
							if (Option.isNone(failure)) {
								game.failStop("ui", exit.cause);
								return {
									...state,
									pendingActions,
									fatalCause: exit.cause,
								};
							}
							if (readOutcomeScope() !== command.outcomeScope) {
								return {
									...state,
									pendingActions,
								};
							}
							const actionErrors = new Map(state.actionErrors);
							actionErrors.set(command.key, {
								message:
									failure.value instanceof Error
										? failure.value.message
										: command.failureMessage,
								outcomeScope: command.outcomeScope,
							});
							return {
								...state,
								pendingActions,
								actionErrors,
							};
						});
					}),
				),
			),
		{
			concurrent: true,
		},
	).pipe(Atom.setIdleTTL(0));

	return Atom.writable(
		(get) => {
			get(runnerAtom);
			const state = get(stateAtom);
			if (state.fatalCause !== undefined) throw state.fatalCause;
			return state;
		},
		(context, command: createItemDetailCommandAtom.Command) => {
			const state = context.get(stateAtom);
			if ("kind" in command) {
				const actionErrors =
					command.outcomeScope === undefined
						? new Map()
						: new Map(
								Array.from(state.actionErrors).filter(
									([, error]) => error.outcomeScope === command.outcomeScope,
								),
							);
				if (actionErrors.size === state.actionErrors.size) return;
				context.set(stateAtom, {
					...state,
					actionErrors,
				});
				return;
			}
			if (state.pendingActions.has(command.key)) return;
			const outcomeScope = readOutcomeScope();
			if (outcomeScope === undefined) return;
			const token = Symbol(command.key);
			const pendingActions = new Map(state.pendingActions);
			pendingActions.set(command.key, {
				action: command.action,
				token,
			});
			const actionErrors = new Map(
				Array.from(state.actionErrors).filter(
					([, error]) => error.outcomeScope === outcomeScope,
				),
			);
			actionErrors.delete(command.key);
			context.set(stateAtom, {
				...state,
				pendingActions,
				actionErrors,
			});
			context.set(runnerAtom, {
				...command,
				outcomeScope,
				token,
			});
		},
	).pipe(Atom.setIdleTTL(0));
};
