import { Effect } from "effect";

import type { EditorProject } from "~/editor/EditorProject";
import { forceDeleteEditorItemFx } from "~/editor/forceDeleteEditorItemFx";
import { readEditorItemDeleteBlockersFx } from "~/editor/readEditorItemDeleteBlockersFx";

export const readEditorMcpItemDeleteImpactFx = Effect.fn("readEditorMcpItemDeleteImpactFx")(
	function* (project: EditorProject, itemId: string) {
		const item = project.config.items[itemId];
		if (item === undefined)
			return yield* Effect.fail(new Error(`Item ${itemId} does not exist.`));
		const blockers = yield* readEditorItemDeleteBlockersFx({
			config: project.config,
			itemId,
		});
		const forced = yield* forceDeleteEditorItemFx({
			config: project.config,
			itemId,
		});
		return {
			blockers,
			impact: forced.impact,
			item,
		};
	},
);

const list = (values: ReadonlyArray<string>) => (values.length === 0 ? "none" : values.join(", "));

/** Prints the exact safe-delete blockers and force-cleanup consequences at one revision. */
export const readEditorMcpItemDeleteImpactTextFx = Effect.fn("readEditorMcpItemDeleteImpactTextFx")(
	function* (project: EditorProject, itemId: string) {
		const { blockers, impact, item } = yield* readEditorMcpItemDeleteImpactFx(project, itemId);
		const lines = [
			"Item delete impact",
			`ID: ${itemId}`,
			`UID: ${item.uid}`,
			`Revision: ${project.revision}`,
			`References: ${blockers.length}`,
			`Safe delete: ${blockers.length === 0 ? "yes" : "no"}`,
		];
		if (blockers.length > 0) {
			lines.push("Reference paths:");
			for (const blocker of blockers)
				lines.push(`- ${blocker.path.join(".")}: ${blocker.message}`);
		}
		lines.push(
			"Force cleanup:",
			`- Owner items deleted: ${list(impact.deletedOwnerItemIds)}`,
			`- Charge outputs removed from: ${list(impact.removedChargeOutputOwnerIds)}`,
			`- Expiry outputs removed from: ${list(impact.removedExpiryOutputOwnerIds)}`,
			`- Lines removed: ${list(impact.removedLines.map(({ ownerItemId, lineId }) => `${ownerItemId}/${lineId}`))}`,
			`- Merge rules removed: ${list(impact.removedMergeRules.map(({ ownerItemId, ruleNumber }) => `${ownerItemId}#${ruleNumber}`))}`,
			`- Start entries removed: board ${impact.removedStartEntries.board}, inventory ${impact.removedStartEntries.inventory}, toolbar ${impact.removedStartEntries.toolbar}`,
		);
		return lines.join("\n");
	},
);
