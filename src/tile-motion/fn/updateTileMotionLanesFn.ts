import { match } from "ts-pattern";

import type { TileMotionCue } from "~/tile-presentation/type/TileMotionCue";

type TileMotionLaneClaim =
	| {
			readonly kind: "exclusive";
			readonly actorId: string;
	  }
	| {
			readonly kind: "delivery-batch";
			readonly actorId: string;
			readonly batchKey: string;
	  };

/** Separates exclusive actor motion from shareable deliveries in one producer batch. */
const readTileMotionLaneClaimsFn = (cue: TileMotionCue) => {
	const batchClaim = (
		actorId: string,
		batchKey = `${cue.sequence}:${cue.originActorId}`,
	): TileMotionLaneClaim => ({
		kind: "delivery-batch",
		actorId,
		batchKey,
	});
	return match(cue)
		.with(
			{
				kind: "spawn",
			},
			(spawn): ReadonlyArray<TileMotionLaneClaim> => [
				batchClaim(spawn.originActorId),
				{
					kind: "exclusive",
					actorId: spawn.actorId,
				},
			],
		)
		.with(
			{
				kind: "stack",
			},
			(stack): ReadonlyArray<TileMotionLaneClaim> => [
				batchClaim(stack.originActorId),
				batchClaim(stack.targetActorId),
			],
		)
		.with(
			{
				kind: "input",
			},
			(input): ReadonlyArray<TileMotionLaneClaim> => [
				{
					kind: "exclusive",
					actorId: input.sourceActorId,
				},
				batchClaim(input.targetActorId, `input:${input.targetActorId}`),
			],
		)
		.with(
			{
				kind: "swap",
			},
			(swap): ReadonlyArray<TileMotionLaneClaim> => [
				{
					kind: "exclusive",
					actorId: swap.actorId,
				},
				{
					kind: "exclusive",
					actorId: swap.counterpartActorId,
				},
			],
		)
		.exhaustive();
};

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

export namespace updateTileMotionLanesFn {
	/** Bounded actor-lane arbitration snapshot owned by one renderer scene. */
	export interface State {
		readonly active: ReadonlyArray<TileMotionCue>;
		readonly pending: ReadonlyArray<TileMotionCue>;
	}

	export interface Props {
		readonly state: State;
		readonly action: TileMotionLanesAction;
	}
}

const readTileMotionCueKey = (cue: TileMotionCue) => `${cue.sequence}:${cue.eventIndex}`;

interface TileMotionLaneSettlement {
	readonly active: TileMotionCue[];
	readonly claims: TileMotionLaneClaim[];
	readonly pending: TileMotionCue[];
	readonly pendingClaims: TileMotionLaneClaim[];
}

const readTileMotionClaims = (cues: ReadonlyArray<TileMotionCue>) =>
	cues.flatMap(readTileMotionLaneClaimsFn);

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

const settleTileMotionLanes = (
	state: updateTileMotionLanesFn.State,
): updateTileMotionLanesFn.State => {
	const settlement: TileMotionLaneSettlement = {
		active: [
			...state.active,
		],
		claims: readTileMotionClaims(state.active),
		pending: [],
		pendingClaims: [],
	};
	for (const cue of state.pending) {
		const cueClaims = readTileMotionLaneClaimsFn(cue);
		if (canActivateTileMotionCue(settlement, cueClaims)) {
			settlement.active.push(cue);
			settlement.claims.push(...cueClaims);
		} else {
			settlement.pending.push(cue);
			settlement.pendingClaims.push(...cueClaims);
		}
	}
	return {
		active: settlement.active,
		pending: settlement.pending,
	};
};

const completeTileMotionCue = ({
	cue,
	state,
}: {
	readonly cue: TileMotionCue;
	readonly state: updateTileMotionLanesFn.State;
}) => {
	const completedKey = readTileMotionCueKey(cue);
	return settleTileMotionLanes({
		active: state.active.filter(
			(activeCue) => readTileMotionCueKey(activeCue) !== completedKey,
		),
		pending: state.pending,
	});
};

const readUniqueIncomingCues = ({
	cues,
	state,
}: {
	readonly cues: ReadonlyArray<TileMotionCue>;
	readonly state: updateTileMotionLanesFn.State;
}) => {
	const knownKeys = new Set(
		[
			...state.active,
			...state.pending,
		].map(readTileMotionCueKey),
	);
	return cues.filter((cue) => {
		const key = readTileMotionCueKey(cue);
		if (knownKeys.has(key)) return false;
		knownKeys.add(key);
		return true;
	});
};

const enqueueTileMotionCues = ({
	cues,
	state,
}: {
	readonly cues: ReadonlyArray<TileMotionCue>;
	readonly state: updateTileMotionLanesFn.State;
}) => {
	return settleTileMotionLanes({
		active: state.active,
		pending: [
			...state.pending,
			...readUniqueIncomingCues({
				cues,
				state,
			}),
		],
	});
};

/** Adds or completes cues, then greedily fills independent bounded actor lanes. */
export const updateTileMotionLanesFn = ({ state, action }: updateTileMotionLanesFn.Props) =>
	match(action)
		.with(
			{
				type: "complete",
			},
			({ cue }) =>
				completeTileMotionCue({
					cue,
					state,
				}),
		)
		.with(
			{
				type: "enqueue",
			},
			({ cues }) =>
				enqueueTileMotionCues({
					cues,
					state,
				}),
		)
		.exhaustive();
