export interface TileEngineRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

export type TileEnginePriority = "normal" | "raised";

export interface TileEngineMotion {
	from: TileEngineRect;
	priority: TileEnginePriority;
	nonce: number;
	kind?: never;
}

export namespace tileEngineMotionRegistry {
	export interface StageEntry {
		tileId: string;
		from: TileEngineRect;
		priority?: TileEnginePriority;
	}

	export interface State {
		motions: Record<string, TileEngineMotion>;
		nextNonce: number;
	}

	export type Action =
		| {
				type: "stage";
				entries: readonly StageEntry[];
		  }
		| {
				type: "settle";
				tileId: string;
				nonce: number;
		  }
		| {
				type: "clear";
		  };
}

export const initialTileEngineMotionRegistryState: tileEngineMotionRegistry.State = {
	motions: {},
	nextNonce: 1,
};

export const tileEngineMotionRegistry = (
	state: tileEngineMotionRegistry.State,
	action: tileEngineMotionRegistry.Action,
): tileEngineMotionRegistry.State => {
	if (action.type === "clear") {
		if (Object.keys(state.motions).length === 0) return state;
		return {
			...state,
			motions: {},
		};
	}

	if (action.type === "settle") {
		const current = state.motions[action.tileId];
		if (!current || current.nonce !== action.nonce) return state;

		const { [action.tileId]: _settled, ...motions } = state.motions;
		return {
			...state,
			motions,
		};
	}

	if (action.entries.length === 0) return state;

	const motions = {
		...state.motions,
	};
	let nextNonce = state.nextNonce;

	for (const entry of action.entries) {
		motions[entry.tileId] = {
			from: entry.from,
			priority: entry.priority ?? "raised",
			nonce: nextNonce,
		};
		nextNonce += 1;
	}

	return {
		motions,
		nextNonce,
	};
};
