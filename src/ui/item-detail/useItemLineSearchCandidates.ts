import { useMemo } from "react";
import { match } from "ts-pattern";

import { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import type { ItemDetailLines } from "~/ui/item-detail/ItemDetailLines";

/** Builds the stable semantic Fuse corpus for the current visible product lines. */
export const useItemLineSearchCandidates = (
	lines: Extract<
		ItemDetailLines.Projection,
		{
			readonly kind: "available";
		}
	>,
) =>
	useMemo(() => {
		const chargeSearchTerms = (charges: ItemDetailLines.ChargeCost | undefined) =>
			charges === undefined
				? []
				: charges.from === "self"
					? [
							"charge",
							"charges",
							"owner charge",
							"self charge",
						]
					: [
							"charge",
							"charges",
							"target charge",
							"deposit charge",
						];
		const inputSearchTerms = (input: ItemDetailLines.Input): readonly string[] =>
			match(input)
				.with(
					{
						kind: "materials",
					},
					(materials) => [
						"input",
						"materials",
						materials.selector.kind,
						materials.selector.label,
						materials.mode,
						materials.mode === "consume" ? "consumed" : "reserved",
						"stored",
						materials.ready ? "ready" : "missing inputs",
						...(materials.detail === undefined
							? []
							: [
									materials.detail.itemId,
									materials.detail.title,
								]),
						...chargeSearchTerms(materials.charges),
					],
				)
				.with(
					{
						kind: "deposit",
					},
					(deposit) => [
						"input",
						"deposit",
						"board",
						deposit.selector.kind,
						deposit.selector.label,
						deposit.distance,
						deposit.ready ? "ready" : "missing inputs",
						...deposit.targetTitles,
						...(deposit.detail === undefined
							? []
							: [
									deposit.detail.itemId,
									deposit.detail.title,
								]),
						...chargeSearchTerms(deposit.charges),
					],
				)
				.with(
					{
						kind: "simple",
					},
					(simple) => [
						"input",
						"owner charge",
						simple.ready ? "ready" : "missing inputs",
						...chargeSearchTerms(simple.charges),
					],
				)
				.exhaustive();
		const outputItemSearchTerms = (item: ItemDetailLines.OutputItem) => [
			"output",
			item.itemId,
			item.title,
		];
		const outputRollSearchTerms = (roll: ItemDetailLines.OutputRoll): readonly string[] =>
			match(roll)
				.with(
					{
						kind: "guaranteed",
					},
					(guaranteed) => [
						"guaranteed",
						...guaranteed.item.flatMap(outputItemSearchTerms),
					],
				)
				.with(
					{
						kind: "chance",
					},
					(chance) => [
						"chance",
						...chance.item.flatMap(outputItemSearchTerms),
					],
				)
				.with(
					{
						kind: "weight",
					},
					(weight) => [
						"weighted",
						"selection",
						...weight.option.flatMap((option) =>
							option.item.flatMap(outputItemSearchTerms),
						),
					],
				)
				.exhaustive();
		const availabilityLabel = (availability: ItemDetailLines.Availability) =>
			match(availability)
				.with(
					{
						kind: "available",
						readiness: "ready",
					},
					() => "Ready",
				)
				.with(
					{
						kind: "unavailable",
					},
					(unavailable) => `Disabled ${unavailable.reason.message}`,
				)
				.with(
					{
						kind: "available",
						readiness: "inputs",
					},
					() => "Missing inputs",
				)
				.with(
					{
						kind: "available",
						readiness: "queue",
					},
					() => "Queue full",
				)
				.exhaustive();
		return lines.line.map((line) => ({
			identity: line.lineId,
			terms: [
				line.lineId,
				line.title,
				line.description,
				availabilityLabel(line.availability),
				...(line.actions.enqueue.enabled
					? [
							"enqueue",
						]
					: []),
				...(line.isDefault
					? [
							"default",
						]
					: []),
				...(line.actions.canWithdraw
					? [
							"withdraw",
						]
					: []),
				...(line.activeJob === undefined
					? []
					: [
							match(line.activeJob.status)
								.with(JobStatusEnumSchema.enum.Running, () => "Running")
								.with(JobStatusEnumSchema.enum.Paused, () => "Paused")
								.with(
									JobStatusEnumSchema.enum.AwaitingOutput,
									() => "Awaiting output",
								)
								.exhaustive(),
						]),
				...line.input.flatMap(inputSearchTerms),
				...line.output.flatMap((set) => set.roll.flatMap(outputRollSearchTerms)),
			],
		}));
	}, [
		lines.line,
	]);
