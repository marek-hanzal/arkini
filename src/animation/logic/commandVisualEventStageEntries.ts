import type { CommandVisualEventSchema } from "~/command/CommandVisualEventSchema";
import {
	visualBoardItemKey,
	visualInventorySlotKey,
	type useVisualItemMotions,
} from "~/play/hook/useVisualItemMotions";
import type { ActiveSheet } from "~/play/logic/playSheetTypes";
import { actorVisualRect } from "./actorVisualRect";
import { locationVisualActorKey } from "./locationVisualActorKey";
import { locationVisualRect } from "./locationVisualRect";

export namespace commandVisualEventStageEntries {
	export interface Props {
		events: readonly CommandVisualEventSchema.Type[];
		activeSheet?: ActiveSheet;
	}
}

const transitionKind = (props: { fromKind?: string; toKind?: string; reason?: string }) => {
	if (props.toKind === "inventory" && props.fromKind === "board") return "exit";
	if (props.fromKind === "inventory" && props.toKind === "board") return "place";
	if (props.reason?.startsWith("activation")) return "place";
	return "move";
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
			if (key && from && to) {
				entries.push({
					key,
					from,
					to,
					priority: "raised",
					kind: transitionKind({
						fromKind: event.from.kind,
						toKind: event.to.kind,
					}),
				});
			}
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
			const sourceKey = locationVisualActorKey({
				itemInstanceId: event.sourceItemInstanceId,
				location: event.sourceTo,
			});
			const targetKey = locationVisualActorKey({
				itemInstanceId: event.targetItemInstanceId,
				location: event.targetTo,
			});
			if (sourceKey && sourceFrom && sourceTo) {
				entries.push({
					key: sourceKey,
					from: sourceFrom,
					to: sourceTo,
					priority: "raised",
					kind: "move",
				});
			}
			if (targetKey && targetFrom && targetTo) {
				entries.push({
					key: targetKey,
					from: targetFrom,
					to: targetTo,
					priority: "raised",
					kind: "move",
				});
			}
			continue;
		}

		if (event.type === "craft.claimed") {
			const rect = actorVisualRect({
				itemInstanceId: event.itemInstanceId,
			});
			if (rect) {
				entries.push({
					key: visualBoardItemKey(event.itemInstanceId),
					from: rect,
					to: rect,
					priority: "raised",
					kind: "place",
				});
			}
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
			if (key && from && to) {
				entries.push({
					key,
					from,
					to,
					priority: "raised",
					kind: transitionKind({
						fromKind: event.from?.kind,
						toKind: event.to.kind,
						reason: event.reason,
					}),
				});
			}
		}
	}

	return entries;
};
