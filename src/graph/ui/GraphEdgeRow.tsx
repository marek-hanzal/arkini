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
	"clock-item-outcome": "Clock expiry output",
	"depletion-item-outcome": "Unit depletion output",
	"rule-reference": "Rule reference",
	"space-outcome": "Space output",
	"template-outcome": "Template output",
	"template-item": "Template placement",
	"start-template": "Starting template",
	"start-space": "Starting space",
} as const satisfies Record<GraphEdge["kind"], string>;

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
	const table = operation?.kind === "clock" ? operation.data.onExpire : operation?.data.outcome;
	const set = annotations.setIndex === undefined ? undefined : table?.set[annotations.setIndex];
	const unitPayer =
		annotations.input?.units === undefined || operation === undefined
			? undefined
			: annotations.input.units.from === "self" || annotations.input.type === "simple"
				? operation.owner
				: `item:${annotations.input.query.selector.itemUid}`;
	const quantity =
		annotations.outcome?.type === "item"
			? annotations.outcome.quantity
			: annotations.input?.type === "materials"
				? annotations.input.quantity
				: undefined;
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
						{operation?.kind === "line" ? (
							<DetailFacts columns={3}>
								<DetailFact
									label={translator.textFn("Line duration")}
									value={formatDurationFn(operation.data.runtimeMs)}
								/>
								<DetailFact
									label={translator.textFn("Clock")}
									value={translator.textFn(
										operation.data.clock ? "Enabled" : "Disabled",
									)}
								/>
								{operation.data.clock ? (
									<DetailFact
										label={translator.textFn("Clock weight")}
										value={operation.data.clockWeight}
									/>
								) : null}
								<DetailFact
									label={translator.textFn("Default")}
									value={translator.textFn(operation.data.default ? "Yes" : "No")}
								/>
								<DetailFact
									label={translator.textFn("Availability")}
									value={translator.textFn(
										operation.data.enable ? "Enabled" : "Disabled",
									)}
								/>
								<DetailFact
									label={translator.textFn("Visibility")}
									value={translator.textFn(
										operation.data.show ? "Visible" : "Hidden",
									)}
								/>
							</DetailFacts>
						) : null}
						{operation?.kind === "merge" ? (
							<div className="grid gap-2">
								<dl
									className="grid grid-cols-3 gap-3"
									data-ui="EditorGraphMergeParticipants"
								>
									<div>
										<dt className="mb-1 text-muted">
											{translator.textFn(
												operation.data.action === "space"
													? "Receiver"
													: "Source",
											)}
										</dt>
										<dd>
											<GraphNodeReference
												id={operation.owner}
												node={nodes.find(
													(node) => node.id === operation.owner,
												)}
											/>
										</dd>
									</div>
									{operation.data.action === "space" ? (
										<>
											<div>
												<dt className="mb-1 text-muted">
													{translator.textFn("Incoming item")}
												</dt>
												<dd>
													{translator.textFn(
														"Any transported incoming item",
													)}
												</dd>
											</div>
											<div>
												<dt className="mb-1 text-muted">
													{translator.textFn("Destination")}
												</dt>
												<dd>
													<GraphNodeReference
														id={`space:${operation.data.space}`}
													/>
												</dd>
											</div>
										</>
									) : (
										<div>
											<dt className="mb-1 text-muted">
												{translator.textFn("Target")}
											</dt>
											<dd>
												<GraphNodeReference
													id={`item:${operation.data.target.itemUid}`}
													node={nodes.find(
														(node) =>
															node.id ===
															`item:${operation.data.action !== "space" ? operation.data.target.itemUid : ""}`,
													)}
												/>
											</dd>
										</div>
									)}
									{operation.data.effect === "replace" ? (
										<div>
											<dt className="mb-1 text-muted">
												{translator.textFn("Replacement")}
											</dt>
											<dd>
												<GraphNodeReference
													id={`item:${operation.data.result}`}
													node={nodes.find(
														(node) =>
															node.id ===
															`item:${operation.data.effect === "replace" ? operation.data.result : ""}`,
													)}
												/>
											</dd>
										</div>
									) : null}
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
						) : null}
						{operation?.kind === "clock" ? (
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
									value={translator.textFn(
										operation.data.enable ? "Enabled" : "Disabled",
									)}
								/>
								{operation.data.durationMs === undefined ? null : (
									<DetailFact
										label={translator.textFn("Expiry mode")}
										value={translator.textFn(
											operation.data.expiryMode === "kill-switch"
												? "Kill switch"
												: "Loose-kill",
										)}
									/>
								)}
							</DetailFacts>
						) : null}
						{operation?.kind === "depletion" ? (
							<DetailFacts>
								<DetailFact
									label={translator.textFn("Initial units")}
									value={operation.data.amount}
								/>
							</DetailFacts>
						) : null}
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
						{operation?.kind === "line" || operation?.kind === "clock" ? (
							operation.data.rules.length > 0 ? (
								<RulesDetail rules={operation.data.rules} />
							) : null
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
