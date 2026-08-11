import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type {
	EditorItemSimulationScenario,
	EditorItemSimulationScenarioResult,
} from "~/editor/simulator/EditorItemSimulation";
import { formatItemDurationFx } from "~/ui/item-detail/formatItemDurationFx";
import { EditorItemDetailReference } from "~/ui/item/editor/EditorItemDetailReference";
import { useEditorItemEstimate } from "~/ui/item/editor/useEditorItemEstimate";
import { Status } from "~/ui/status/Status";

const ScenarioTitle = {
	expected: "Expected",
	guaranteed: "Guaranteed",
} as const;

const ScenarioDescription = {
	expected: "Expected output yield is used, then batches are rounded up to whole runs.",
	guaranteed: "Minimum quantities are used and non-guaranteed chance output counts as zero.",
} as const;

const ScenarioOrder: ReadonlyArray<EditorItemSimulationScenario> = [
	"expected",
	"guaranteed",
];

const BlockerTitle = {
	"dependency-cycle": "Dependency cycle",
	"missing-source": "Missing source",
	"operation-blocked": "Blocked operation",
	"production-stalled": "Production stalled",
	"run-limit": "Run limit reached",
} as const;

const formatQuantity = (quantity: number) =>
	Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/\.00$/, "");

const EditorItemEstimateScenarioCard = ({
	config,
	projectId,
	scenario,
}: {
	readonly config: ReturnType<typeof useEditorProject>["config"];
	readonly projectId: string;
	readonly scenario: EditorItemSimulationScenarioResult;
}) => (
	<article
		className={`flex min-h-0 min-w-0 flex-col rounded-lg border border-l-2 bg-surface-raised p-4 ${
			scenario.scenario === "expected"
				? "border-violet-300 border-l-violet-600"
				: "border-line border-l-line-strong"
		}`}
		data-scenario={scenario.scenario}
		data-ui="EditorItemEstimateScenario"
	>
		<header className="flex items-start justify-between gap-4 border-b border-line/70 pb-3">
			<div>
				<h3 className="font-semibold text-foreground">
					{ScenarioTitle[scenario.scenario]}
				</h3>
				<p className="mt-1 text-xs text-muted">
					{scenario.status === "estimated"
						? `${scenario.cost.length} consumed item types`
						: `${scenario.blockers.length} production ${scenario.blockers.length === 1 ? "blocker" : "blockers"}`}
				</p>
			</div>
			<div className="text-right">
				<p className="font-semibold tabular-nums text-foreground">
					{scenario.status === "estimated"
						? `${formatQuantity(scenario.totalCostQuantity)} items`
						: "Blocked"}
				</p>
				<p className="mt-1 text-xs tabular-nums text-muted">
					{scenario.runtimeMs === undefined
						? "No runtime estimate"
						: RendererRuntime.runSync(formatItemDurationFx(scenario.runtimeMs))}
				</p>
			</div>
		</header>
		{scenario.status === "no-finite-path" ? (
			<ul className="min-h-0 flex-1 divide-y divide-line/60 overflow-y-auto pr-1">
				{scenario.blockers.map((blocker) => {
					const item = config.items[blocker.itemId];
					return (
						<li
							className="grid gap-1.5 py-3"
							key={`${blocker.code}:${blocker.itemId}:${blocker.operationId ?? ""}`}
						>
							<p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
								{BlockerTitle[blocker.code]}
							</p>
							{item === undefined ? (
								<span className="text-sm font-medium text-muted">
									{blocker.itemId} [missing]
								</span>
							) : (
								<EditorItemDetailReference
									item={item}
									projectId={projectId}
									sectionId="estimate"
								/>
							)}
							<p className="text-xs leading-relaxed text-muted">{blocker.message}</p>
							{blocker.operationId === undefined ? null : (
								<code className="text-[0.6875rem] text-muted">
									{blocker.operationId}
								</code>
							)}
						</li>
					);
				})}
			</ul>
		) : scenario.cost.length === 0 ? (
			<p className="py-4 text-sm text-muted">No consumed items.</p>
		) : (
			<ul className="min-h-0 flex-1 divide-y divide-line/60 overflow-y-auto pr-1">
				{scenario.cost.map(({ itemId, quantity }) => {
					const item = config.items[itemId];
					return (
						<li
							className="flex min-h-14 items-center justify-between gap-3 py-1.5 text-sm"
							key={itemId}
						>
							{item === undefined ? (
								<span
									className="min-w-0 truncate text-muted"
									title={itemId}
								>
									{itemId} [missing]
								</span>
							) : (
								<EditorItemDetailReference
									item={item}
									projectId={projectId}
									sectionId="estimate"
								/>
							)}
							<strong className="shrink-0 tabular-nums text-foreground">
								× {formatQuantity(quantity)}
							</strong>
						</li>
					);
				})}
			</ul>
		)}
	</article>
);

const EditorItemEstimateMethodCard = () => (
	<article
		className="col-span-2 min-w-0 rounded-lg border border-l-2 border-line border-l-sky-600 bg-surface-raised p-4 max-[64rem]:col-span-1"
		data-ui="EditorItemEstimateMethod"
	>
		<header className="flex items-start gap-3 border-b border-line/70 pb-3">
			<span className="icon-[lucide--calculator] mt-0.5 size-5 shrink-0 text-sky-700" />
			<div>
				<h3 className="font-semibold text-foreground">How it is calculated</h3>
				<p className="mt-1 text-xs text-muted">Shared assumptions and scenario rules</p>
			</div>
		</header>
		<dl className="divide-y divide-line/60">
			{ScenarioOrder.map((scenario) => (
				<div
					className="grid gap-1 py-3"
					key={scenario}
				>
					<dt className="text-sm font-semibold text-foreground">
						{ScenarioTitle[scenario]}
					</dt>
					<dd className="text-xs leading-relaxed text-muted">
						{ScenarioDescription[scenario]}
					</dd>
				</div>
			))}
		</dl>
		<ul className="grid gap-2 border-t border-line/70 pt-3 text-xs leading-relaxed text-muted">
			<li>
				Production, line rules, drop rules, runtime modifiers, and charges are simulated.
			</li>
			<li>Finite deposits block the path unless gameplay output can recreate them.</li>
			<li>All gameplay operations are scheduled sequentially.</li>
			<li>Starting items on the configured current board cost no added runtime.</li>
			<li>Spatial rules pass optimistically when their required items can exist on board.</li>
			<li>
				Board coordinates, capacity, placement, and additional spaces are not simulated.
			</li>
		</ul>
	</article>
);

/** Shows the shared domain estimate in one item's read-only Estimate section. */
export const EditorItemEstimateSection = ({ itemId }: { readonly itemId: string }) => {
	const project = useEditorProject();
	const state = useEditorItemEstimate(project.config, itemId);
	return (
		<section
			className="grid gap-4"
			data-ui="EditorItemEstimateSection"
		>
			<header>
				<h2 className="text-lg font-semibold text-foreground">Estimated total cost</h2>
			</header>
			{state.status === "loading" ? (
				<Status
					dataUi="EditorItemEstimateLoading"
					description="Simulating production, rules, charges, and finite sources."
					icon="icon-[lucide--loader-circle] animate-spin"
					title="Calculating estimate"
				/>
			) : null}
			{state.status === "error" ? (
				<Status
					dataUi="EditorItemEstimateError"
					description={state.message}
					icon="icon-[lucide--triangle-alert]"
					title="Estimate calculation failed"
				/>
			) : null}
			{state.status === "ready" ? (
				<div className="grid grid-cols-2 gap-3 max-[64rem]:grid-cols-1">
					{ScenarioOrder.map((scenarioId) => {
						const scenario = state.estimate.scenarios.find(
							(candidate) => candidate.scenario === scenarioId,
						);
						return scenario === undefined ? null : (
							<EditorItemEstimateScenarioCard
								config={project.config}
								key={scenario.scenario}
								projectId={project.projectId}
								scenario={scenario}
							/>
						);
					})}
					<EditorItemEstimateMethodCard />
				</div>
			) : null}
		</section>
	);
};
