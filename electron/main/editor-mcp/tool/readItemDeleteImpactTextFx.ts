import { Effect } from "effect";

import type { EditorProject } from "~/editor/EditorProject";
import { readItemDeleteImpactFx } from "./readItemDeleteImpactFx";

const list = (values: ReadonlyArray<string>) => (values.length === 0 ? "none" : values.join(", "));

/** Prints the exact safe-delete blockers and force-cleanup consequences at one revision. */
export const readItemDeleteImpactTextFx = Effect.fn("readItemDeleteImpactTextFx")(function* (
	project: EditorProject,
	itemId: string,
) {
	const { blockers, impact, item } = yield* readItemDeleteImpactFx(project, itemId);
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
});
