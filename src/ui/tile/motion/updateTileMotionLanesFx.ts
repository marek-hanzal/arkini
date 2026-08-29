import { Effect } from "effect";
import { match } from "ts-pattern";

import type { TileMotionCue } from "~/ui/pixi/motion/TileMotionCue";
import type { TileMotionLanesState } from "~/ui/tile/motion/TileMotionLanesState";
import {
	type TileMotionLaneClaim,
	readTileMotionLaneClaimsFx,
} from "~/ui/tile/motion/readTileMotionLaneClaimsFx";

const maximumActiveLanes = 8;

type TileMotionLanesAction =
	| {
			readonly type: "enqueue";
			readonly cues: ReadonlyArray<TileMotionCue>;
	  }
	| {
			readonly type: "complete";
			readonly cue: TileMotionCue;
	  };

const readTileMotionCueKeyFx = Effect.fn("readTileMotionCueKeyFx")((cue: TileMotionCue) =>
	Effect.succeed(`${cue.sequence}:${cue.eventIndex}`),
);

interface TileMotionLaneSettlement {
	readonly active: ReadonlyArray<TileMotionCue>;
	readonly claims: ReadonlyArray<TileMotionLaneClaim>;
	readonly pending: ReadonlyArray<TileMotionCue>;
	readonly pendingClaims: ReadonlyArray<TileMotionLaneClaim>;
}

const readTileMotionClaimsFx = Effect.fn("readTileMotionClaimsFx")(
	(cues: ReadonlyArray<TileMotionCue>) =>
		Effect.forEach(cues, readTileMotionLaneClaimsFx).pipe(
			Effect.map((claims) => claims.flat()),
		),
);

const tileMotionLaneClaimsConflict = (left: TileMotionLaneClaim, right: TileMotionLaneClaim) =>
	left.actorId === right.actorId &&
	(left.kind === "exclusive" || right.kind === "exclusive" || left.batchKey !== right.batchKey);

const canActivateTileMotionCue = (
	settlement: TileMotionLaneSettlement,
	cueClaims: ReadonlyArray<TileMotionLaneClaim>,
) =>
	settlement.active.length < maximumActiveLanes &&
	cueClaims.every(
		(cueClaim) =>
			settlement.claims.every(
				(activeClaim) => !tileMotionLaneClaimsConflict(cueClaim, activeClaim),
			) &&
			settlement.pendingClaims.every(
				(pendingClaim) => !tileMotionLaneClaimsConflict(cueClaim, pendingClaim),
			),
	);

const settleTileMotionLanesFx = Effect.fn("settleTileMotionLanesFx")(function* (
	state: TileMotionLanesState,
) {
	const claims = yield* readTileMotionClaimsFx(state.active);
	const settlement = yield* Effect.reduce(
		state.pending,
		() =>
			({
				active: [
					...state.active,
				],
				claims,
				pending: [] as ReadonlyArray<TileMotionCue>,
				pendingClaims: [] as ReadonlyArray<TileMotionLaneClaim>,
			}) satisfies TileMotionLaneSettlement,
		(current, cue) =>
			readTileMotionLaneClaimsFx(cue).pipe(
				Effect.map((cueClaims) =>
					canActivateTileMotionCue(current, cueClaims)
						? {
								active: [
									...current.active,
									cue,
								],
								claims: [
									...current.claims,
									...cueClaims,
								],
								pending: current.pending,
								pendingClaims: current.pendingClaims,
							}
						: {
								...current,
								pending: [
									...current.pending,
									cue,
								],
								pendingClaims: [
									...current.pendingClaims,
									...cueClaims,
								],
							},
				),
			),
	);
	return {
		active: settlement.active,
		pending: settlement.pending,
	} satisfies TileMotionLanesState;
});

const completeTileMotionCueFx = Effect.fn("completeTileMotionCueFx")(function* ({
	cue,
	state,
}: {
	readonly cue: TileMotionCue;
	readonly state: TileMotionLanesState;
}) {
	const completedKey = yield* readTileMotionCueKeyFx(cue);
	const keyedActiveCues = yield* Effect.forEach(state.active, (activeCue) =>
		readTileMotionCueKeyFx(activeCue).pipe(
			Effect.map((key) => ({
				cue: activeCue,
				key,
			})),
		),
	);
	return yield* settleTileMotionLanesFx({
		active: keyedActiveCues
			.filter(({ key }) => key !== completedKey)
			.map(({ cue: activeCue }) => activeCue),
		pending: state.pending,
	});
});

interface UniqueIncomingCues {
	readonly cues: ReadonlyArray<TileMotionCue>;
	readonly knownKeys: ReadonlySet<string>;
}

const readUniqueIncomingCuesFx = Effect.fn("readUniqueIncomingCuesFx")(function* ({
	cues,
	state,
}: {
	readonly cues: ReadonlyArray<TileMotionCue>;
	readonly state: TileMotionLanesState;
}) {
	const knownKeys = new Set(
		yield* Effect.forEach(
			[
				...state.active,
				...state.pending,
			],
			readTileMotionCueKeyFx,
		),
	);
	return yield* Effect.reduce(
		cues,
		() =>
			({
				cues: [] as ReadonlyArray<TileMotionCue>,
				knownKeys,
			}) satisfies UniqueIncomingCues,
		(unique, cue) =>
			readTileMotionCueKeyFx(cue).pipe(
				Effect.map((key) =>
					unique.knownKeys.has(key)
						? unique
						: {
								cues: [
									...unique.cues,
									cue,
								],
								knownKeys: new Set([
									...unique.knownKeys,
									key,
								]),
							},
				),
			),
	);
});

const enqueueTileMotionCuesFx = Effect.fn("enqueueTileMotionCuesFx")(function* ({
	cues,
	state,
}: {
	readonly cues: ReadonlyArray<TileMotionCue>;
	readonly state: TileMotionLanesState;
}) {
	const incoming = yield* readUniqueIncomingCuesFx({
		cues,
		state,
	});
	return yield* settleTileMotionLanesFx({
		active: state.active,
		pending: [
			...state.pending,
			...incoming.cues,
		],
	});
});

export namespace updateTileMotionLanesFx {
	export interface Props {
		readonly state: TileMotionLanesState;
		readonly action: TileMotionLanesAction;
	}
}

/** Adds or completes cues, then greedily fills independent bounded actor lanes. */
export const updateTileMotionLanesFx = Effect.fn("updateTileMotionLanesFx")(function* ({
	state,
	action,
}: updateTileMotionLanesFx.Props) {
	return yield* match(action)
		.with(
			{
				type: "complete",
			},
			({ cue }) =>
				completeTileMotionCueFx({
					cue,
					state,
				}),
		)
		.with(
			{
				type: "enqueue",
			},
			({ cues }) =>
				enqueueTileMotionCuesFx({
					cues,
					state,
				}),
		)
		.exhaustive();
});
