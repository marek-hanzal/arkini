import type { QueryClient } from "@tanstack/react-query";
import { patchBoardViewCache } from "~/v0/board/cache/patchBoardViewCache";
import { patchInventoryViewCache } from "~/v0/inventory/cache/patchInventoryViewCache";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { patchBoardVisualEvents } from "~/v0/play/cache/applyBoardVisualEvent";
import { patchInventoryVisualEvents } from "~/v0/play/cache/applyInventoryVisualEvent";

export namespace applyVisualEvents {
	export interface Props {
		queryClient: QueryClient;
		events: readonly ActionVisualEventSchema.Type[];
	}
}

export const applyVisualEvents = ({ events, queryClient }: applyVisualEvents.Props) => {
	patchBoardViewCache({
		queryClient,
		patch: (board) => patchBoardVisualEvents(board, events),
	});
	patchInventoryViewCache({
		queryClient,
		patch: (inventory) => patchInventoryVisualEvents(inventory, events),
	});
};
