import { Effect } from "effect";

import type { GameSchema } from "~/v1/schema/GameSchema";
import type { RuntimeBoardItemSchema } from "~/v1/runtime/schema/RuntimeBoardItemSchema";
import type { StateBoardItemSchema } from "~/v1/state/schema/StateBoardItemSchema";
import { resolveRuntimeItemFx } from "./resolveRuntimeItemFx";

export namespace hydrateRuntimeBoardItemFx {
	export interface Props {
		game: GameSchema.Type;
		state: StateBoardItemSchema.Type;
	}
}

/**
 * Hydrates one persisted board item with its canonical item reference.
 */
export const hydrateRuntimeBoardItemFx = Effect.fn("hydrateRuntimeBoardItemFx")(function* ({
	game,
	state,
}: hydrateRuntimeBoardItemFx.Props) {
	const item = yield* resolveRuntimeItemFx({
		game,
		itemId: state.itemId,
	});
	const result = {
		id: state.id,
		item,
		quantity: state.quantity,
		x: state.x,
		y: state.y,
	};

	return result satisfies RuntimeBoardItemSchema.Type;
});
