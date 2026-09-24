import { readGraphSpaceDestinationIdFn } from "~/graph/fn/readGraphSpaceDestinationIdFn";
import { match } from "ts-pattern";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { GraphEdge, GraphFacts, GraphNode, GraphOperation } from "~/graph/type/GraphFacts";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import type { RuleSchema } from "~/production-line/schema/RuleSchema";

type Source = readonly (string | number)[];
type Rules = readonly RuleSchema.Type[];

const orderFn = (
	a: {
		readonly id: string;
	},
	b: {
		readonly id: string;
	},
) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Compiles occurrences, never availability: even impossible guards and zero-chance rolls are facts. */
export const compileGraphFactsFn = (config: GameConfigSchema.Type): GraphFacts => {
	const nodes = new Map<string, GraphNode>();
	const templates = new Map(
		(config.templates ?? []).map((template) => [
			template.uid,
			template,
		]),
	);
	const operations: GraphOperation[] = [];
	const operationSources = new Map<string, Source>();
	const operationFn = (operation: GraphOperation) => {
		operations.push(operation);
		operationSources.set(operation.id, operation.source);
	};
	const edges: GraphEdge[] = [];
	const nodeFn = (kind: GraphNode["kind"], key: string, source: Source): string => {
		const id = kind === "start" ? "start" : `${kind}:${key}`;
		if (!nodes.has(id)) {
			const item =
				kind === "item" && Object.hasOwn(config.items, key) ? config.items[key] : undefined;
			const inventoryTemplateUid =
				kind === "space" && key.startsWith("inventory:") ? key.slice(10) : undefined;
			const template = kind === "template" ? templates.get(key) : undefined;
			const inventoryTemplate =
				inventoryTemplateUid === undefined
					? undefined
					: templates.get(inventoryTemplateUid);
			nodes.set(id, {
				id,
				kind,
				...(inventoryTemplateUid === undefined
					? {}
					: {
							templateUid: inventoryTemplateUid,
						}),
				...(item?.clock === undefined
					? {}
					: {
							clock: {
								...(item.clock.intervalMs === undefined
									? {}
									: {
											intervalSeconds: item.clock.intervalMs / 1000,
										}),
								...(item.clock.durationMs === undefined
									? {}
									: {
											durationSeconds: item.clock.durationMs / 1000,
										}),
							},
						}),
				title:
					item?.title ??
					template?.title ??
					(kind === "space"
						? inventoryTemplateUid !== undefined
							? `Inventory · ${inventoryTemplate?.title ?? inventoryTemplateUid}`
							: key === "previous"
								? "Previous Space"
								: `Space ${key}`
						: key),
				missing: match(kind)
					.with("item", () => item === undefined)
					.with("template", () => template === undefined)
					.with(
						"space",
						() => inventoryTemplateUid !== undefined && inventoryTemplate === undefined,
					)
					.with("start", () => false)
					.exhaustive(),
				source:
					kind === "item" && item !== undefined
						? [
								"items",
								key,
							]
						: source,
			});
		}
		return id;
	};
	const edgeFn = (
		from: string,
		to: string,
		kind: GraphEdge["kind"],
		source: Source,
		operationId?: string,
		annotations: GraphEdge["annotations"] = {},
	) => {
		// JSON tuples avoid collisions between legal UIDs, separators and authored array indices.
		const localSource =
			operationId === undefined
				? source
				: source.slice(operationSources.get(operationId)?.length ?? 0);
		edges.push({
			id: JSON.stringify([
				operationId ?? "config",
				localSource,
				kind,
			]),
			from,
			to,
			kind,
			source,
			operationId,
			annotations,
		});
	};
	const rulesFn = (
		owner: string,
		operationId: string,
		rules: Rules,
		path: Source,
		annotations: GraphEdge["annotations"] = {},
	) => {
		for (const [ruleIndex, rule] of rules.entries()) {
			for (const [whenIndex, condition] of rule.when.entries()) {
				const source = [
					...path,
					ruleIndex,
					"when",
					whenIndex,
					"query",
					"selector",
					"itemUid",
				];
				edgeFn(
					owner,
					nodeFn("item", condition.query.selector.itemUid, source),
					"rule-reference",
					source,
					operationId,
					{
						...annotations,
						rule,
						condition,
						ruleIndex,
						whenIndex,
						boardLocal: true,
					},
				);
			}
		}
	};
	const outcomeFn = (
		owner: string,
		operationId: string,
		table: OutcomeTableSchema.Type | undefined,
		path: Source,
		itemKind: GraphEdge["kind"],
	) => {
		for (const [setIndex, set] of (table?.set ?? []).entries()) {
			const setPath = [
				...path,
				"set",
				setIndex,
			];
			const setAnnotations = {
				setId: JSON.stringify([
					operationId,
					"set",
					setIndex,
				]),
				setIndex,
				setWeight: set.weight,
				alternative: (table?.set.length ?? 0) > 1,
			};
			rulesFn(
				owner,
				operationId,
				set.rules,
				[
					...setPath,
					"rules",
				],
				setAnnotations,
			);
			for (const [rollIndex, roll] of set.roll.entries()) {
				const rollPath = [
					...setPath,
					"roll",
					rollIndex,
				];
				const rollAnnotations = {
					...setAnnotations,
					rollId: JSON.stringify([
						operationId,
						"set",
						setIndex,
						"roll",
						rollIndex,
					]),
					rollIndex,
					rollType: roll.type,
					chance: roll.type === "chance" ? roll.chance : undefined,
				};
				for (const [outcomeIndex, outcome] of roll.outcome.entries()) {
					const outcomePath = [
						...rollPath,
						"outcome",
						outcomeIndex,
					];
					const annotations = {
						...rollAnnotations,
						outcomeIndex,
						outcome,
						boardLocal: outcome.type !== "space",
					};
					const target = match(outcome)
						.with(
							{
								type: "item",
							},
							({ itemUid }) => ({
								kind: "item" as const,
								key: itemUid,
								field: "itemUid",
								edgeKind: itemKind,
							}),
						)
						.with(
							{
								type: "space",
							},
							({ space }) => ({
								kind: "space" as const,
								key: readGraphSpaceDestinationIdFn(space).slice(6),
								field: "space",
								edgeKind: "space-outcome" as const,
							}),
						)
						.with(
							{
								type: "template",
							},
							({ templateUid }) => ({
								kind: "template" as const,
								key: templateUid,
								field: "templateUid",
								edgeKind: "template-outcome" as const,
							}),
						)
						.exhaustive();
					const source = [
						...outcomePath,
						target.field,
						...(outcome.type === "space" && typeof outcome.space === "object"
							? [
									"templateUid",
								]
							: []),
					];
					edgeFn(
						owner,
						nodeFn(target.kind, target.key, source),
						target.edgeKind,
						source,
						operationId,
						annotations,
					);
					rulesFn(
						owner,
						operationId,
						outcome.rules,
						[
							...outcomePath,
							"rules",
						],
						annotations,
					);
				}
			}
		}
	};
	for (const key of Object.keys(config.items).sort())
		nodeFn("item", key, [
			"items",
			key,
		]);
	for (const [index, template] of (config.templates ?? []).entries())
		nodeFn("template", template.uid, [
			"templates",
			index,
		]);
	for (const key of Object.keys(config.items).sort()) {
		const item = config.items[key]!;
		const owner = `item:${key}`;
		const base = [
			"items",
			key,
		];
		for (const [lineIndex, line] of item.lines.entries()) {
			const source = [
				...base,
				"lines",
				lineIndex,
			];
			const id = JSON.stringify([
				"line",
				line.uid,
			]);
			operationFn({
				id,
				owner,
				kind: "line",
				source,
				data: line,
			});
			for (const [inputIndex, input] of line.input.entries()) {
				const inputPath = [
					...source,
					"input",
					inputIndex,
				];
				const annotations = {
					input,
					inputIndex,
					boardLocal: true,
				};
				if (input.type !== "simple") {
					const ref = [
						...inputPath,
						"query",
						"selector",
						"itemUid",
					];
					edgeFn(
						nodeFn("item", input.query.selector.itemUid, ref),
						owner,
						input.type === "materials" ? "line-material" : "line-unit-selector",
						ref,
						id,
						annotations,
					);
				}
				if (input.units !== undefined) {
					const ref = [
						...inputPath,
						"units",
						"from",
					];
					const payer = match(input)
						.with(
							{
								units: {
									from: "self",
								},
							},
							() => owner,
						)
						.with(
							{
								type: "simple",
							},
							() => undefined,
						)
						.with(
							{
								type: "materials",
							},
							{
								type: "units",
							},
							({ query }) => nodeFn("item", query.selector.itemUid, ref),
						)
						.exhaustive();
					if (payer !== undefined)
						edgeFn(payer, owner, "line-unit-cost", ref, id, annotations);
				}
			}
			rulesFn(owner, id, line.rules, [
				...source,
				"rules",
			]);
			outcomeFn(
				owner,
				id,
				line.outcome,
				[
					...source,
					"outcome",
				],
				"line-item-outcome",
			);
		}
		for (const [mergeIndex, merge] of (item.merge ?? []).entries()) {
			const source = [
				...base,
				"merge",
				mergeIndex,
			];
			const id = JSON.stringify([
				owner,
				"merge",
				mergeIndex,
			]);
			operationFn({
				id,
				owner,
				kind: "merge",
				source,
				data: merge,
			});
			const role = merge.action === "space" ? "receiver" : "source";
			if (merge.action === "space") {
				const ref = [
					...source,
					"space",
					...(typeof merge.space === "object"
						? [
								"templateUid",
							]
						: []),
				];
				edgeFn(
					owner,
					nodeFn("space", readGraphSpaceDestinationIdFn(merge.space).slice(6), ref),
					"merge-space",
					ref,
					id,
					{
						role,
					},
				);
			} else {
				const ref = [
					...source,
					"target",
					"itemUid",
				];
				edgeFn(owner, nodeFn("item", merge.target.itemUid, ref), "merge-target", ref, id, {
					role: "target",
					boardLocal: true,
				});
				if (merge.action === "spend")
					edgeFn(
						owner,
						owner,
						"merge-source-spend",
						[
							...source,
							"action",
						],
						id,
						{
							role: "source",
							boardLocal: true,
						},
					);
			}
			if (merge.effect === "spend") {
				const target =
					merge.action === "space"
						? owner
						: nodeFn("item", merge.target.itemUid, [
								...source,
								"target",
								"itemUid",
							]);
				edgeFn(
					owner,
					target,
					"merge-target-spend",
					[
						...source,
						"effect",
					],
					id,
					{
						role: merge.action === "space" ? "receiver" : "target",
						boardLocal: true,
					},
				);
			}
			if (merge.effect === "replace") {
				const ref = [
					...source,
					"result",
				];
				edgeFn(owner, nodeFn("item", merge.result, ref), "merge-replacement", ref, id, {
					role: merge.action === "space" ? "receiver" : "target",
					boardLocal: true,
				});
				if (merge.action !== "space")
					edgeFn(
						nodeFn("item", merge.target.itemUid, [
							...source,
							"target",
							"itemUid",
						]),
						nodeFn("item", merge.result, ref),
						"merge-target-replacement",
						ref,
						id,
						{
							role: "target",
							boardLocal: true,
						},
					);
			}
			outcomeFn(
				owner,
				id,
				merge.outcome,
				[
					...source,
					"outcome",
				],
				"merge-item-outcome",
			);
		}
		if (item.units !== undefined) {
			const source = [
				...base,
				"units",
			];
			const id = JSON.stringify([
				owner,
				"depletion",
			]);
			operationFn({
				id,
				owner,
				source,
				kind: "depletion",
				data: item.units,
			});
			outcomeFn(
				owner,
				id,
				item.units.outcome,
				[
					...source,
					"outcome",
				],
				"depletion-item-outcome",
			);
		}
		if (item.clock !== undefined) {
			const source = [
				...base,
				"clock",
			];
			const id = JSON.stringify([
				owner,
				"clock",
			]);
			operationFn({
				id,
				owner,
				source,
				kind: "clock",
				data: item.clock,
			});
			rulesFn(owner, id, item.clock.rules, [
				...source,
				"rules",
			]);
			outcomeFn(
				owner,
				id,
				item.clock.onExpire,
				[
					...source,
					"onExpire",
				],
				"clock-item-outcome",
			);
		}
	}
	for (const [index, template] of (config.templates ?? []).entries()) {
		for (const [cellIndex, cell] of template.board.entries()) {
			const source = [
				"templates",
				index,
				"board",
				cellIndex,
				"itemUid",
			];
			edgeFn(
				`template:${template.uid}`,
				nodeFn("item", cell.itemUid, source),
				"template-item",
				source,
				undefined,
				{
					position: {
						x: cell.x,
						y: cell.y,
					},
				},
			);
		}
	}
	nodeFn("start", "Start", [
		"start",
	]);
	edgeFn(
		"start",
		nodeFn("space", String(config.start.currentSpace), [
			"start",
			"currentSpace",
		]),
		"start-space",
		[
			"start",
			"currentSpace",
		],
	);
	for (const [index, entry] of config.start.spaces.entries()) {
		const source = [
			"start",
			"spaces",
			index,
		];
		const space = nodeFn("space", String(entry.space), [
			...source,
			"space",
		]);
		edgeFn("start", space, "start-space", [
			...source,
			"space",
		]);
		edgeFn(
			space,
			nodeFn("template", entry.templateUid, [
				...source,
				"templateUid",
			]),
			"start-template",
			[
				...source,
				"templateUid",
			],
		);
	}
	return {
		nodes: [
			...nodes.values(),
		].sort(orderFn),
		operations: operations.sort(orderFn),
		edges: edges.sort(orderFn),
	};
};
