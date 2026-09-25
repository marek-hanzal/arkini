import { readGraphSpaceDestinationIdFn } from "~/graph/fn/readGraphSpaceDestinationIdFn";
import { match, P } from "ts-pattern";
import { ArrowRight } from "lucide-react";
import type { GraphEdge, GraphNode, GraphOperation } from "~/graph/type/GraphFacts";
import { GraphNodeReference } from "~/graph/ui/GraphNodeReference";
import { GraphOriginLink } from "~/graph/ui/GraphOriginLink";
import { DetailFact, DetailFacts } from "~/item-authoring/ui/DetailDefinition";
import { RulesDetail } from "~/item-authoring/ui/RulesDetail";
import { QueryDetail } from "~/item-authoring/ui/QueryDetail";
import { useTranslator } from "~/translation/ui/useTranslator";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";

const KindLabels = {
	"line-material": "Line material",
	"line-unit-selector": "Line unit selector",
	"line-unit-cost": "Line unit cost",
	"line-item-outcome": "Line output",
	"merge-target": "Merge target",
	"merge-replacement": "Merge replacement",
	"merge-target-replacement": "Merge target replacement",
	"merge-item-outcome": "Merge extra output",
	"merge-space": "Merge transport",
	"merge-source-spend": "Merge source unit cost",
	"merge-target-spend": "Merge target unit cost",
	"depletion-item-outcome": "Unit depletion output",
	"rule-reference": "Rule reference",
	"space-outcome": "Space output",
	"template-outcome": "Template output",
	"template-item": "Template placement",
	"start-template": "Starting template",
	"start-space": "Starting space",
} as const satisfies Record<GraphEdge["kind"], string>;

const GraphOperationDetails = ({
	operation,
	nodes,
}: {
	readonly operation: GraphOperation;
	readonly nodes: readonly GraphNode[];
}) => {
	const translator = useTranslator();
	return match(operation)
		.with(
			{
				kind: "line",
			},
			(operation) => (
				<DetailFacts columns={3}>
					<DetailFact
						label={translator.textFn("Line duration")}
						value={formatDurationFn(operation.data.runtimeMs)}
					/>
					<DetailFact
						label={translator.textFn("Trigger")}
						value={operation.data.trigger}
					/>
					{operation.data.trigger !== "manual" ? (
						<DetailFact
							label={translator.textFn("Weight")}
							value={operation.data.weight}
						/>
					) : null}
					<DetailFact
						label={translator.textFn("Default")}
						value={translator.textFn(operation.data.default ? "Yes" : "No")}
					/>
					<DetailFact
						label={translator.textFn("Availability")}
						value={translator.textFn(operation.data.enable ? "Enabled" : "Disabled")}
					/>
					<DetailFact
						label={translator.textFn("Visibility")}
						value={translator.textFn(operation.data.show ? "Visible" : "Hidden")}
					/>
				</DetailFacts>
			),
		)
		.with(
			{
				kind: "merge",
			},
			(operation) => (
				<div className="grid gap-2">
					<dl
						className="grid grid-cols-3 gap-3"
						data-ui="EditorGraphMergeParticipants"
					>
						<div>
							<dt className="mb-1 text-muted">
								{translator.textFn(
									operation.data.action === "space" ? "Receiver" : "Source",
								)}
							</dt>
							<dd>
								<GraphNodeReference
									id={operation.owner}
									node={nodes.find((node) => node.id === operation.owner)}
								/>
							</dd>
						</div>
						{match(operation.data)
							.with(
								{
									action: "space",
								},
								(merge) => (
									<>
										<div>
											<dt className="mb-1 text-muted">
												{translator.textFn("Incoming item")}
											</dt>
											<dd>
												{translator.textFn("Any transported incoming item")}
											</dd>
										</div>
										<div>
											<dt className="mb-1 text-muted">
												{translator.textFn("Destination")}
											</dt>
											<dd>
												<GraphNodeReference
													id={readGraphSpaceDestinationIdFn(merge.space)}
												/>
											</dd>
										</div>
									</>
								),
							)
							.with(
								{
									action: P.union("use", "consume", "spend"),
								},
								(merge) => (
									<div>
										<dt className="mb-1 text-muted">
											{translator.textFn("Target")}
										</dt>
										<dd>
											<GraphNodeReference
												id={`item:${merge.target.itemUid}`}
												node={nodes.find(
													(node) =>
														node.id === `item:${merge.target.itemUid}`,
												)}
											/>
										</dd>
									</div>
								),
							)
							.exhaustive()}
						{match(operation.data)
							.with(
								{
									effect: "replace",
								},
								(merge) => (
									<div>
										<dt className="mb-1 text-muted">
											{translator.textFn("Replacement")}
										</dt>
										<dd>
											<GraphNodeReference
												id={`item:${merge.result}`}
												node={nodes.find(
													(node) => node.id === `item:${merge.result}`,
												)}
											/>
										</dd>
									</div>
								),
							)
							.with(
								{
									effect: P.union("keep", "remove", "spend"),
								},
								() => null,
							)
							.exhaustive()}
					</dl>
					<DetailFacts>
						<DetailFact
							label={translator.textFn("Source action")}
							value={translator.textFn(
								{
									use: "Use",
									consume: "Consume",
									spend: "Spend one unit",
									space: "Transport incoming item",
								}[operation.data.action],
							)}
						/>
						<DetailFact
							label={translator.textFn(
								operation.data.action === "space"
									? "Receiver effect"
									: "Target effect",
							)}
							value={translator.textFn(
								{
									keep: "Keep",
									remove: "Remove",
									replace: "Replace",
									spend: "Spend one unit",
								}[operation.data.effect],
							)}
						/>
					</DetailFacts>
				</div>
			),
		)
		.with(
			{
				kind: "clock",
			},
			(operation) => (
				<DetailFacts columns={3}>
					<DetailFact
						label={translator.textFn("Clock interval")}
						value={
							operation.data.intervalMs === undefined
								? translator.textFn("None")
								: formatDurationFn(operation.data.intervalMs)
						}
					/>
					<DetailFact
						label={translator.textFn("Lifetime")}
						value={
							operation.data.durationMs === undefined
								? translator.textFn("Unlimited")
								: formatDurationFn(operation.data.durationMs)
						}
					/>
					<DetailFact
						label={translator.textFn("Timer")}
						value={translator.textFn(operation.data.enable ? "Enabled" : "Disabled")}
					/>
				</DetailFacts>
			),
		)
		.with(
			{
				kind: "depletion",
			},
			(operation) => (
				<DetailFacts>
					<DetailFact
						label={translator.textFn("Units")}
						value={operation.data.amount}
					/>
				</DetailFacts>
			),
		)
		.exhaustive();
};

/** One row per authored occurrence; same endpoints never hide distinct roles or source paths. */
export const GraphEdgeRow = ({
	edge,
	nodes,
	operation,
}: {
	readonly edge: GraphEdge;
	readonly nodes: readonly GraphNode[];
	readonly operation?: GraphOperation;
}) => {
	const translator = useTranslator();
	const annotations = edge.annotations;
	const table =
		operation?.kind === "line" || operation?.kind === "merge"
			? operation.data.outcome
			: undefined;
	const set = annotations.setIndex === undefined ? undefined : table?.set[annotations.setIndex];
	const unitPayer =
		annotations.input?.units === undefined || operation === undefined
			? undefined
			: match(annotations.input)
					.with(
						{
							units: {
								from: "self",
							},
						},
						{
							type: "simple",
						},
						() => operation.owner,
					)
					.with(
						{
							type: P.union("materials", "units"),
						},
						({ query }) => `item:${query.selector.itemUid}`,
					)
					.exhaustive();
	const quantity = match(annotations)
		.with(
			{
				outcome: {
					type: "item",
				},
			},
			({ outcome }) => outcome.quantity,
		)
		.with(
			{
				input: {
					type: "materials",
				},
			},
			({ input }) => input.quantity,
		)
		.otherwise(() => undefined);
	return (
		<article
			className="ak-list-row min-w-0 p-3"
			data-ui="EditorGraphEdge"
			data-edge-kind={edge.kind}
		>
			<div className="flex min-w-0 items-center gap-3">
				<GraphNodeReference
					id={edge.from}
					node={nodes.find((node) => node.id === edge.from)}
				/>
				<ArrowRight className="size-4 shrink-0 text-muted" />
				<GraphNodeReference
					id={edge.to}
					node={nodes.find((node) => node.id === edge.to)}
				/>
				<span className="ml-auto text-xs font-semibold text-accent">
					{translator.textFn(KindLabels[edge.kind])}
				</span>
			</div>
			<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
				<GraphOriginLink
					edge={edge}
					operation={operation}
				/>
				{quantity === undefined ? null : (
					<span>
						×
						{quantity.min === quantity.max
							? quantity.min
							: `${quantity.min}–${quantity.max}`}
					</span>
				)}
				{annotations.input?.units === undefined ? null : (
					<span>
						{translator.textFn("Unit cost")}: {annotations.input.units.cost}
					</span>
				)}
				{annotations.input?.type !== "materials" ? null : (
					<span>
						{translator.textFn(
							annotations.input.mode === "consume" ? "Consume" : "Reserve",
						)}
					</span>
				)}
				{annotations.setIndex === undefined ? null : (
					<span>
						{translator.textFn(
							annotations.alternative ? "Alternative set" : "Output set",
						)}{" "}
						{annotations.setIndex + 1} · {translator.textFn("Weight")}{" "}
						{annotations.setWeight}
					</span>
				)}
				{annotations.rollIndex === undefined ? null : (
					<span>
						{translator.textFn("Roll")} {annotations.rollIndex + 1} ·{" "}
						{annotations.rollType === "chance"
							? `${translator.textFn("Chance")} ${(annotations.chance ?? 0) * 100}%`
							: translator.textFn("Guaranteed")}
					</span>
				)}
				{annotations.position === undefined ? null : (
					<span>
						({annotations.position.x}, {annotations.position.y})
					</span>
				)}
			</div>
			{operation === undefined ? null : (
				<details
					className="mt-2 text-xs"
					data-ui="EditorGraphEdgeDetails"
				>
					<summary className="cursor-pointer text-muted">
						{translator.textFn("Details")}
					</summary>
					<div className="mt-2 grid gap-3">
						<GraphOperationDetails
							operation={operation}
							nodes={nodes}
						/>
						{unitPayer === undefined ? null : (
							<DetailFacts>
								<DetailFact
									label={translator.textFn("Unit payer")}
									value={
										<GraphNodeReference
											id={unitPayer}
											node={nodes.find((node) => node.id === unitPayer)}
										/>
									}
								/>
							</DetailFacts>
						)}
						{annotations.input === undefined ||
						annotations.input.type === "simple" ? null : (
							<QueryDetail query={annotations.input.query} />
						)}
						{annotations.outcome?.type === "item" ? (
							<DetailFacts>
								<DetailFact
									label={translator.textFn("Board placement")}
									value={translator.textFn(
										annotations.outcome.placement === "random"
											? "Random"
											: "Drop",
									)}
								/>
							</DetailFacts>
						) : null}
						{(operation.kind === "line" || operation.kind === "clock") &&
						operation.data.rules.length > 0 ? (
							<RulesDetail rules={operation.data.rules} />
						) : null}
						{set === undefined || set.rules.length === 0 ? null : (
							<div>
								<p className="mb-1 font-semibold">
									{translator.textFn("Output set")}
								</p>
								<RulesDetail rules={set.rules} />
							</div>
						)}
						{annotations.outcome === undefined ||
						annotations.outcome.rules.length === 0 ? null : (
							<div>
								<p className="mb-1 font-semibold">{translator.textFn("Outcome")}</p>
								<RulesDetail rules={annotations.outcome.rules} />
							</div>
						)}
					</div>
				</details>
			)}
		</article>
	);
};
