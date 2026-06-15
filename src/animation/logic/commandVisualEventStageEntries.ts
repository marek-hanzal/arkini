import type { CommandVisualEventSchema } from "~/command/CommandVisualEventSchema";
import {
	visualBoardItemKey,
	visualInventorySlotKey,
	visualInventoryStackKey,
	type useVisualItemMotions,
} from "~/play/hook/useVisualItemMotions";
import type { ActiveSheet } from "~/play/logic/playSheetTypes";
import type { RectLike, VisualTransitionKind } from "~/play/types";
import { actorVisualRect } from "./actorVisualRect";
import { locationVisualActorKey } from "./locationVisualActorKey";
import { locationVisualRect } from "./locationVisualRect";

export namespace commandVisualEventStageEntries {
	export interface Props {
		events: readonly CommandVisualEventSchema.Type[];
		activeSheet?: ActiveSheet;
	}
}

const transitionKind = (props: {
	fromKind?: string;
	toKind?: string;
	reason?: string;
}): VisualTransitionKind => {
	if (props.toKind === "inventory" && props.fromKind === "board") return "exit";
	if (props.fromKind === "inventory" && props.toKind === "board") return "place";
	if (props.reason?.startsWith("activation")) return "place";
	return "move";
};

const sameRectEntry = (props: {
	key: string;
	rect: RectLike | null;
	kind: VisualTransitionKind;
	priority?: useVisualItemMotions.StageEntry["priority"];
}): useVisualItemMotions.StageEntry[] => {
	if (!props.rect) return [];

	return [
		{
			key: props.key,
			from: props.rect,
			to: props.rect,
			priority: props.priority ?? "raised",
			kind: props.kind,
		},
	];
};

const moveEntry = (props: {
	key?: string;
	from: RectLike | null;
	to: RectLike | null;
	kind: VisualTransitionKind;
	priority?: useVisualItemMotions.StageEntry["priority"];
}): useVisualItemMotions.StageEntry[] => {
	if (!props.key || !props.from || !props.to) return [];

	return [
		{
			key: props.key,
			from: props.from,
			to: props.to,
			priority: props.priority ?? "raised",
			kind: props.kind,
		},
	];
};

export const commandVisualEventStageEntries = ({
	events,
	activeSheet,
}: commandVisualEventStageEntries.Props): useVisualItemMotions.StageEntry[] => {
	const entries: useVisualItemMotions.StageEntry[] = [];

	for (const event of events) {
		if (event.type === "item.moved") {
			const from = locationVisualRect({
				location: event.from,
				itemInstanceId: event.itemInstanceId,
				activeSheet,
			});
			const to = locationVisualRect({
				location: event.to,
				itemInstanceId: event.itemInstanceId,
				activeSheet,
				fallbackSourceRect: from,
			});
			const key =
				locationVisualActorKey({
					itemInstanceId: event.itemInstanceId,
					location: event.to,
				}) ??
				locationVisualActorKey({
					itemInstanceId: event.itemInstanceId,
					location: event.from,
				});

			entries.push(
				...moveEntry({
					key,
					from,
					to,
					kind: transitionKind({
						fromKind: event.from.kind,
						toKind: event.to.kind,
					}),
				}),
			);
			continue;
		}

		if (event.type === "item.swapped") {
			const sourceFrom = locationVisualRect({
				location: event.sourceFrom,
				itemInstanceId: event.sourceItemInstanceId,
				activeSheet,
			});
			const sourceTo = locationVisualRect({
				location: event.sourceTo,
				itemInstanceId: event.sourceItemInstanceId,
				activeSheet,
				fallbackSourceRect: sourceFrom,
			});
			const targetFrom = locationVisualRect({
				location: event.targetFrom,
				itemInstanceId: event.targetItemInstanceId,
				activeSheet,
			});
			const targetTo = locationVisualRect({
				location: event.targetTo,
				itemInstanceId: event.targetItemInstanceId,
				activeSheet,
				fallbackSourceRect: targetFrom,
			});

			entries.push(
				...moveEntry({
					key: locationVisualActorKey({
						itemInstanceId: event.sourceItemInstanceId,
						location: event.sourceTo,
					}),
					from: sourceFrom,
					to: sourceTo,
					kind: "move",
				}),
				...moveEntry({
					key: locationVisualActorKey({
						itemInstanceId: event.targetItemInstanceId,
						location: event.targetTo,
					}),
					from: targetFrom,
					to: targetTo,
					kind: "move",
				}),
			);
			continue;
		}

		if (event.type === "item.merged") {
			const sourceRect = actorVisualRect({
				itemInstanceId: event.sourceItemInstanceId,
			});
			const targetRect = actorVisualRect({
				itemInstanceId: event.targetItemInstanceId,
			});

			if (event.consumeSource) {
				entries.push(
					...moveEntry({
						key: visualBoardItemKey(event.sourceItemInstanceId),
						from: sourceRect,
						to: targetRect,
						kind: "consume",
					}),
				);
			}
			entries.push(
				...sameRectEntry({
					key: visualBoardItemKey(event.targetItemInstanceId),
					rect: targetRect,
					kind: event.consumeSource ? "place" : "consume",
				}),
			);
			continue;
		}

		if (event.type === "item.fed") {
			const sourceRect = actorVisualRect({
				itemInstanceId: event.sourceItemInstanceId,
			});
			const targetRect = actorVisualRect({
				itemInstanceId: event.targetItemInstanceId,
			});

			entries.push(
				...moveEntry({
					key: visualBoardItemKey(event.sourceItemInstanceId),
					from: sourceRect,
					to: targetRect,
					kind: "consume",
				}),
				...sameRectEntry({
					key: visualBoardItemKey(event.targetItemInstanceId),
					rect: targetRect,
					kind: "place",
				}),
			);
			continue;
		}

		if (event.type === "item.consumed") {
			const rect = event.from
				? locationVisualRect({
						location: event.from,
						itemInstanceId: event.itemInstanceId,
						activeSheet,
					})
				: actorVisualRect({
						itemInstanceId: event.itemInstanceId,
					});
			const key = event.from
				? locationVisualActorKey({
						itemInstanceId: event.itemInstanceId,
						location: event.from,
					})
				: undefined;

			entries.push(
				...sameRectEntry({
					key: key ?? visualBoardItemKey(event.itemInstanceId),
					rect,
					kind: event.from?.kind === "inventory" ? "exit" : "consume",
				}),
			);
			continue;
		}

		if (event.type === "item.spawned") {
			const from = event.from
				? locationVisualRect({
						location: event.from,
						itemInstanceId: event.itemInstanceId,
						activeSheet,
					})
				: actorVisualRect({
						itemInstanceId: event.originItemInstanceId,
					});
			const to = locationVisualRect({
				location: event.to,
				itemInstanceId: event.itemInstanceId,
				activeSheet,
				fallbackSourceRect: from,
			});
			const key =
				locationVisualActorKey({
					itemInstanceId: event.itemInstanceId,
					location: event.to,
				}) ??
				(event.to.kind === "inventory"
					? visualInventorySlotKey(event.to.slotIndex)
					: undefined);

			entries.push(
				...moveEntry({
					key,
					from,
					to,
					kind: transitionKind({
						fromKind: event.from?.kind,
						toKind: event.to.kind,
						reason: event.reason,
					}),
				}),
			);
			continue;
		}

		if (event.type === "activation.activated") {
			const rect = actorVisualRect({
				itemInstanceId: event.itemInstanceId,
			});
			entries.push(
				...sameRectEntry({
					key: visualBoardItemKey(event.itemInstanceId),
					rect,
					kind: "place",
				}),
			);
			continue;
		}

		if (event.type === "activation.depleted") {
			const rect = actorVisualRect({
				itemInstanceId: event.itemInstanceId,
			});
			entries.push(
				...sameRectEntry({
					key: visualBoardItemKey(event.itemInstanceId),
					rect,
					kind: event.depletion.kind === "remove" ? "exit" : "place",
				}),
			);
			continue;
		}

		if (event.type === "inventory.stacked") {
			const sourceRect = actorVisualRect({
				itemInstanceId: event.sourceItemInstanceId,
			});
			const targetRect = actorVisualRect({
				itemInstanceId: event.targetItemInstanceId,
			});

			entries.push(
				...moveEntry({
					key: visualBoardItemKey(event.sourceItemInstanceId),
					from: sourceRect,
					to: targetRect,
					kind: "consume",
				}),
				...sameRectEntry({
					key: visualInventoryStackKey(event.targetItemInstanceId),
					rect: targetRect,
					kind: "place",
				}),
			);
			continue;
		}

		if (event.type === "craft.started") {
			const rect = actorVisualRect({
				itemInstanceId: event.itemInstanceId,
			});
			entries.push(
				...sameRectEntry({
					key: visualBoardItemKey(event.itemInstanceId),
					rect,
					kind: "place",
				}),
			);
			continue;
		}

		if (event.type === "craft.claimed") {
			const rect = actorVisualRect({
				itemInstanceId: event.itemInstanceId,
			});
			entries.push(
				...sameRectEntry({
					key: visualBoardItemKey(event.itemInstanceId),
					rect,
					kind: "place",
				}),
			);
			continue;
		}
	}

	return entries;
};
