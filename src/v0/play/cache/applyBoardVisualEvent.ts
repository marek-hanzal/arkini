import { match } from "ts-pattern";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import { rebuildBoardView } from "~/v0/board/view/rebuildBoardView";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { toTileEnterMotion } from "~/v0/play/motion/toTileEnterMotion";

const createBoardItem = (
	event: Extract<
		ActionVisualEventSchema.Type,
		{
			type: "item.spawned";
		}
	>,
): BoardViewItem | null => {
	if (event.to.kind !== "board" || !event.itemInstanceId) return null;

	return {
		id: event.itemInstanceId,
		itemId: event.itemId,
		x: event.to.x,
		y: event.to.y,
		state: {},
		motion: {
			enter: toTileEnterMotion(event.animation),
		},
	};
};

const upsertBoardItem = (board: BoardView, item: BoardViewItem) =>
	rebuildBoardView([
		...board.items.filter((entry) => entry.id !== item.id),
		item,
	]);

const removeBoardItem = (board: BoardView, boardItemId: string) =>
	rebuildBoardView(board.items.filter((item) => item.id !== boardItemId));

export const applyBoardVisualEvent = (
	board: BoardView,
	event: ActionVisualEventSchema.Type,
): BoardView =>
	match(event)
		.with(
			{
				type: "item.spawned",
			},
			(spawned) => {
				const item = createBoardItem(spawned);
				if (!item || board.byId[item.id]) return board;

				return rebuildBoardView([
					...board.items.filter(
						(entry) =>
							!(
								entry.id.startsWith("cache:") &&
								entry.itemId === item.itemId &&
								entry.x === item.x &&
								entry.y === item.y
							),
					),
					item,
				]);
			},
		)
		.with(
			{
				type: "item.moved",
			},
			(moved) => {
				if (moved.from.kind === "board" && moved.to.kind !== "board") {
					return removeBoardItem(board, moved.itemInstanceId);
				}
				if (moved.to.kind !== "board") return board;

				const existing = board.byId[moved.itemInstanceId];
				return upsertBoardItem(board, {
					...(existing ?? {
						id: moved.itemInstanceId,
						itemId: moved.itemId,
						state: {},
					}),
					x: moved.to.x,
					y: moved.to.y,
				});
			},
		)
		.with(
			{
				type: "item.swapped",
			},
			(swapped) => {
				const source = board.byId[swapped.sourceItemInstanceId];
				const target = board.byId[swapped.targetItemInstanceId];
				if (!source || !target) return board;

				return rebuildBoardView(
					board.items.map((item) => {
						if (item.id === source.id && swapped.sourceTo.kind === "board") {
							return {
								...item,
								x: swapped.sourceTo.x,
								y: swapped.sourceTo.y,
							};
						}
						if (item.id === target.id && swapped.targetTo.kind === "board") {
							return {
								...item,
								x: swapped.targetTo.x,
								y: swapped.targetTo.y,
							};
						}
						return item;
					}),
				);
			},
		)
		.with(
			{
				type: "item.merged",
			},
			(merged) => {
				const source = board.byId[merged.sourceItemInstanceId];
				const target = board.byId[merged.targetItemInstanceId];
				if (!target) return board;
				if (!source && target.itemId === merged.resultItemId) return board;

				return rebuildBoardView(
					board.items.flatMap((item) => {
						if (merged.consumeSource && item.id === merged.sourceItemInstanceId) {
							return [];
						}
						if (item.id !== merged.targetItemInstanceId) {
							return [
								item,
							];
						}

						return [
							{
								...item,
								itemId: merged.resultItemId,
								state: {},
								activation: undefined,
								craft: undefined,
								motion: {
									enter: toTileEnterMotion(merged.animation),
								},
							},
						];
					}),
				);
			},
		)
		.with(
			{
				type: "item.fed",
			},
			(fed) => removeBoardItem(board, fed.sourceItemInstanceId),
		)
		.with(
			{
				type: "item.consumed",
			},
			(consumed) => removeBoardItem(board, consumed.itemInstanceId),
		)
		.with(
			{
				type: "activation.activated",
			},
			(activated) => {
				const source = board.byId[activated.itemInstanceId];
				const activation = source?.activation;
				if (!source || !activation) return board;

				const cooldownUntilMs = activation.cooldownMs
					? Date.now() + activation.cooldownMs
					: activation.cooldownUntilMs;
				const remainingCharges =
					activation.kind === "stash"
						? activated.mode === "exhaust"
							? 0
							: Math.max(0, (activation.remainingCharges ?? 1) - 1)
						: activation.remainingCharges;

				return rebuildBoardView(
					board.items.map((item) =>
						item.id === source.id
							? {
									...item,
									activation: {
										...activation,
										cooldownUntilMs,
										remainingCharges,
									},
								}
							: item,
					),
				);
			},
		)
		.with(
			{
				type: "activation.depleted",
			},
			(depleted) =>
				match(depleted.depletion)
					.with(
						{
							kind: "remove",
						},
						() => removeBoardItem(board, depleted.itemInstanceId),
					)
					.with(
						{
							kind: "replace",
						},
						(replacement) => {
							const source = board.byId[depleted.itemInstanceId];
							if (!source) return board;

							return rebuildBoardView(
								board.items.map((item) =>
									item.id === source.id
										? {
												...item,
												itemId: replacement.itemId,
												state: {},
												activation: undefined,
												craft: undefined,
											}
										: item,
								),
							);
						},
					)
					.exhaustive(),
		)
		.with(
			{
				type: "craft.started",
			},
			(started) => {
				const target = board.byId[started.itemInstanceId];
				const craft = target?.craft;
				if (!target || !craft) return board;

				const startedAtMs = Date.now();
				return rebuildBoardView(
					board.items.map((item) =>
						item.id === target.id
							? {
									...item,
									craft: {
										...craft,
										phase:
											started.readyAtMs && started.readyAtMs <= startedAtMs
												? "ready"
												: "waiting",
										complete: Boolean(
											started.readyAtMs && started.readyAtMs <= startedAtMs,
										),
										progress: 0,
										timeProgress: 0,
										startedAtMs,
										readyAtMs: started.readyAtMs,
										remainingMs: started.readyAtMs
											? Math.max(0, started.readyAtMs - startedAtMs)
											: undefined,
										canAcceptInputs: false,
										acceptedInputItemIds: [],
									},
								}
							: item,
					),
				);
			},
		)
		.with(
			{
				type: "craft.claimed",
			},
			(claimed) => {
				const target = board.byId[claimed.itemInstanceId];
				if (!target) return board;

				return rebuildBoardView(
					board.items.map((item) =>
						item.id === target.id
							? {
									...item,
									itemId: claimed.resultItemId,
									state: {},
									activation: undefined,
									craft: undefined,
								}
							: item,
					),
				);
			},
		)
		.otherwise(() => board);

export const patchBoardVisualEvents = (
	board: BoardView,
	events: readonly ActionVisualEventSchema.Type[],
) => events.reduce((current, event) => applyBoardVisualEvent(current, event), board);
