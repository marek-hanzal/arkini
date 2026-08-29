import { match } from "ts-pattern";

import type { TileMotionCue } from "~/ui/pixi/motion/TileMotionCue";
import type { TileMotionLanesState } from "~/ui/tile/motion/TileMotionLanesState";
import {
	type TileMotionLaneClaim,
	readTileMotionLaneClaimsFn,
} from "~/ui/tile/motion/fn/readTileMotionLaneClaimsFn";

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

const settleTileMotionLanes = (state: TileMotionLanesState): TileMotionLanesState => {
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
	readonly state: TileMotionLanesState;
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
	readonly state: TileMotionLanesState;
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
	readonly state: TileMotionLanesState;
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

export namespace updateTileMotionLanesFn {
	export interface Props {
		readonly state: TileMotionLanesState;
		readonly action: TileMotionLanesAction;
	}
}

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
