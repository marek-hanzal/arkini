import { Effect } from "effect";

import { selectorFx } from "~/v1/selector/fx/selectorFx";
import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { GameSourceProvenanceSchema } from "~/v1/source/schema/GameSourceProvenanceSchema";
import type { GameDiagnosticsSchema } from "~/v1/validation/schema/GameDiagnosticsSchema";
import { readItemLineEntriesFx } from "../fx/readItemLineEntriesFx";

export namespace validateInputChargesFx {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Validates who may pay each authored line-input charge cost. */
export const validateInputChargesFx = Effect.fn("validateInputChargesFx")(function* ({
	config,
	provenance,
}: validateInputChargesFx.Props) {
	const diagnostics: GameDiagnosticsSchema.Type = [];

	for (const [itemId, item] of Object.entries(config.items)) {
		const lines = yield* readItemLineEntriesFx({
			itemId,
			item,
		});
		for (const { line, path } of lines) {
			let selfCost = 0;
			for (const [inputIndex, input] of line.input.entries()) {
				const diagnosticPath = [
					...path,
					"input",
					inputIndex,
					"charges",
				];
				if (input.type === "deposit" && input.charges === undefined) {
					diagnostics.push({
						code: "input:charges-invalid",
						severity: "error",
						path: diagnosticPath,
						source: provenance.items[itemId],
						message: `Deposit input ${inputIndex} of line ${line.id} must author a target charge cost.`,
						ownerItemId: itemId,
						lineId: line.id,
						inputIndex,
						reason: "deposit-missing-target-cost",
					});
					continue;
				}
				if (input.charges === undefined) continue;

				if (input.charges.from === "self") {
					if (input.type === "deposit") {
						diagnostics.push({
							code: "input:charges-invalid",
							severity: "error",
							path: diagnosticPath,
							source: provenance.items[itemId],
							message: `Deposit input ${inputIndex} of line ${line.id} must charge its target, not its owner.`,
							ownerItemId: itemId,
							lineId: line.id,
							inputIndex,
							reason: "deposit-must-target",
						});
						continue;
					}
					if (item.charges === undefined) {
						diagnostics.push({
							code: "input:charges-invalid",
							severity: "error",
							path: diagnosticPath,
							source: provenance.items[itemId],
							message: `Line ${line.id} charges owner ${itemId}, but the item has no charges.`,
							ownerItemId: itemId,
							lineId: line.id,
							inputIndex,
							reason: "self-missing-charges",
						});
						continue;
					}
					selfCost += input.charges.cost;
					if (selfCost > item.charges.amount) {
						diagnostics.push({
							code: "input:charges-invalid",
							severity: "error",
							path: diagnosticPath,
							source: provenance.items[itemId],
							message: `Line ${line.id} costs ${selfCost} total self charges, but ${itemId} has only ${item.charges.amount}.`,
							ownerItemId: itemId,
							lineId: line.id,
							inputIndex,
							reason: "self-insufficient-charges",
						});
					}
					continue;
				}

				if (input.type !== "deposit") {
					diagnostics.push({
						code: "input:charges-invalid",
						severity: "error",
						path: diagnosticPath,
						source: provenance.items[itemId],
						message: `Only deposit inputs may charge an external target; line ${line.id} input ${inputIndex} is ${input.type}.`,
						ownerItemId: itemId,
						lineId: line.id,
						inputIndex,
						reason: "target-requires-deposit",
					});
					continue;
				}

				let available = false;
				for (const candidate of Object.values(config.items)) {
					const matches = yield* selectorFx({
						selector: input.query.selector,
						item: candidate,
					});
					if (
						matches &&
						candidate.charges !== undefined &&
						candidate.charges.amount >= input.charges.cost
					) {
						available = true;
						break;
					}
				}
				if (!available) {
					diagnostics.push({
						code: "input:charges-invalid",
						severity: "error",
						path: diagnosticPath,
						source: provenance.items[itemId],
						message: `Deposit input ${inputIndex} of line ${line.id} cannot match any item with at least ${input.charges.cost} charges.`,
						ownerItemId: itemId,
						lineId: line.id,
						inputIndex,
						reason: "target-unavailable",
					});
				}
			}
		}
	}

	return diagnostics;
});
