import { Cause, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { makeExactGameAtomFamilyFx } from "~/bridge/game/makeExactGameAtomFamilyFx";
import { readExactCauseFailure } from "~/bridge/game/readExactCauseFailure";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { autofillLineInputsFx } from "~/engine/input/write/autofillLineInputsFx";
import { startLineFx } from "~/engine/job/write/startLineFx";

export namespace TileDefaultLineCommandAtom {
	export type Command =
		| {
				readonly kind: "reset";
		  }
		| {
				readonly kind: "start";
				readonly lineId: string;
				readonly ownerItemId: string;
		  };

	export type State =
		| {
				readonly kind: "idle";
		  }
		| {
				readonly kind: "pending";
				readonly ownerItemId: string;
		  }
		| {
				readonly kind: "error";
				readonly error: unknown;
				readonly ownerItemId: string;
		  };
}

/** Synchronously admits one primary line start for the mounted Pixi game surface. */
export const TileDefaultLineCommandAtom = RendererRuntime.runSync(
	makeExactGameAtomFamilyFx((game) => {
		const stateAtom = Atom.make<TileDefaultLineCommandAtom.State>({
			kind: "idle",
		}).pipe(Atom.setIdleTTL(0));
		const runnerAtom = Atom.fn(
			(
				command: Extract<
					TileDefaultLineCommandAtom.Command,
					{
						readonly kind: "start";
					}
				>,
			) =>
				Effect.gen(function* () {
					const exit = yield* Effect.exit(
						game.runFx(
							autofillLineInputsFx({
								lineId: command.lineId,
								ownerItemId: command.ownerItemId,
							}).pipe(
								Effect.andThen(
									startLineFx({
										lineId: command.lineId,
										ownerItemId: command.ownerItemId,
									}),
								),
							),
						),
					);
					if (Exit.isFailure(exit)) {
						if (Cause.hasInterruptsOnly(exit.cause)) {
							return yield* Effect.failCause(exit.cause);
						}
						const failure = readExactCauseFailure(exit.cause);
						yield* Atom.set(stateAtom, {
							kind: "error",
							error: Option.isSome(failure) ? failure.value : exit.cause,
							ownerItemId: command.ownerItemId,
						});
						return;
					}
					yield* Atom.set(stateAtom, {
						kind: "idle",
					});
				}),
			{
				concurrent: true,
			},
		).pipe(Atom.setIdleTTL(0));

		return Atom.writable(
			(get) => {
				get(runnerAtom);
				return get(stateAtom);
			},
			(context, command: TileDefaultLineCommandAtom.Command) => {
				if (command.kind === "reset") {
					context.set(stateAtom, {
						kind: "idle",
					});
					return;
				}
				if (context.get(stateAtom).kind === "pending") return;
				context.set(stateAtom, {
					kind: "pending",
					ownerItemId: command.ownerItemId,
				});
				context.set(runnerAtom, command);
			},
		).pipe(Atom.setIdleTTL(0));
	}),
);
