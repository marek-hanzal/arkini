import { useEffect, useMemo, useState } from "react";
import { match } from "ts-pattern";

import type { ItemDetailLines } from "~/item-line-detail/ui/ItemDetailLines";
import { JobStatusEnumSchema } from "~/production-job/schema/read/JobStatusEnumSchema";
import { useFuseSearch } from "~/ui/search/useFuseSearch";

type ItemLineAvailabilityFilter = "available" | "all";

const isAvailableLineFn = (line: ItemDetailLines.Line) =>
	line.availability.kind === "available" || line.activeJob !== undefined;

const useItemLineSearchCandidates = (
	lines: Extract<
		ItemDetailLines.Projection,
		{
			readonly kind: "available";
		}
	>,
) =>
	useMemo(() => {
		const readChargeSearchTermsFn = (charges: ItemDetailLines.ChargeCost | undefined) =>
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
		const readInputSearchTermsFn = (input: ItemDetailLines.Input): readonly string[] =>
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
						...readChargeSearchTermsFn(materials.charges),
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
						...readChargeSearchTermsFn(deposit.charges),
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
						...readChargeSearchTermsFn(simple.charges),
					],
				)
				.exhaustive();
		const readOutputItemSearchTermsFn = (item: ItemDetailLines.OutputItem) => [
			"output",
			item.itemId,
			item.title,
		];
		const readOutputRollSearchTermsFn = (roll: ItemDetailLines.OutputRoll): readonly string[] =>
			match(roll)
				.with(
					{
						kind: "guaranteed",
					},
					(guaranteed) => [
						"guaranteed",
						...guaranteed.item.flatMap(readOutputItemSearchTermsFn),
					],
				)
				.with(
					{
						kind: "chance",
					},
					(chance) => [
						"chance",
						...chance.item.flatMap(readOutputItemSearchTermsFn),
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
							option.item.flatMap(readOutputItemSearchTermsFn),
						),
					],
				)
				.exhaustive();
		const readAvailabilityLabelFn = (availability: ItemDetailLines.Availability) =>
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
				readAvailabilityLabelFn(line.availability),
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
				...line.input.flatMap(readInputSearchTermsFn),
				...line.output.flatMap((set) => set.roll.flatMap(readOutputRollSearchTermsFn)),
			],
		}));
	}, [
		lines.line,
	]);

/** Owns local filtering and resolves semantic search identities in authored line order. */
export const useItemLineSearch = (
	lines: Extract<
		ItemDetailLines.Projection,
		{
			readonly kind: "available";
		}
	>,
	initialQuery = "",
	ignoreAvailability = false,
) => {
	const [query, setQuery] = useState(initialQuery);
	const availableLineCount = useMemo(
		() => lines.line.filter(isAvailableLineFn).length,
		[
			lines.line,
		],
	);
	const [availabilityFilter, setAvailabilityFilter] = useState<ItemLineAvailabilityFilter>(() =>
		ignoreAvailability || initialQuery.trim() !== "" || availableLineCount === 0
			? "all"
			: "available",
	);
	useEffect(() => {
		if (availabilityFilter !== "available" || availableLineCount !== 0) return;
		setAvailabilityFilter("all");
	}, [
		availabilityFilter,
		availableLineCount,
	]);
	const selectedLines = useMemo(
		() =>
			ignoreAvailability || availabilityFilter === "all"
				? lines.line
				: lines.line.filter(isAvailableLineFn),
		[
			availabilityFilter,
			ignoreAvailability,
			lines.line,
		],
	);
	const selectedProjection = useMemo(
		() => ({
			...lines,
			line: selectedLines,
		}),
		[
			lines,
			selectedLines,
		],
	);
	const searchCandidates = useItemLineSearchCandidates(selectedProjection);
	const matchingLineIds = useFuseSearch(searchCandidates, query);
	const matchingLineIdSet = useMemo(
		() => new Set(matchingLineIds),
		[
			matchingLineIds,
		],
	);
	const filteredLines = useMemo(
		() => selectedLines.filter((line) => matchingLineIdSet.has(line.lineId)),
		[
			matchingLineIdSet,
			selectedLines,
		],
	);
	return {
		availabilityFilter,
		availableLineCount,
		setAvailabilityFilter,
		query,
		setQuery,
		filteredLines,
		normalizedQuery: query.trim(),
	};
};
