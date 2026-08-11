import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { EditorItemSimulation } from "~/editor/simulator/EditorItemSimulation";
import { formatItemDurationFx } from "~/ui/item-detail/formatItemDurationFx";
import { EditorItemDetailReference } from "~/ui/item/editor/EditorItemDetailReference";
import { useEditorItemEstimate } from "~/ui/item/editor/useEditorItemEstimate";
import { Status } from "~/ui/status/Status";

const BlockerTitle = {
	"dependency-cycle": "Dependency cycle",
	"missing-source": "Missing source",
	"operation-blocked": "Blocked operation",
	"production-stalled": "Production stalled",
	"run-limit": "Run limit reached",
} as const;

const formatQuantity = (quantity: number) =>
	Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/\.00$/, "");

const EditorItemEstimateResultCard = ({
	config,
	estimate,
	projectId,
}: {
	readonly config: ReturnType<typeof useEditorProject>["config"];
	readonly estimate: EditorItemSimulation;
	readonly projectId: string;
}) => (
	<article
		className="flex min-h-0 min-w-0 flex-col rounded-lg border border-l-2 border-violet-300 border-l-violet-600 bg-surface-raised p-4"
		data-ui="EditorItemEstimateResult"
	>
		<header className="flex items-start justify-between gap-4 border-b border-line/70 pb-3">
			<div>
				<h3 className="font-semibold text-foreground">Expected</h3>
				<p className="mt-1 text-xs text-muted">
					{estimate.status === "estimated"
						? `${estimate.cost.length} consumed item types`
						: `${estimate.blockers.length} production ${estimate.blockers.length === 1 ? "blocker" : "blockers"}`}
				</p>
			</div>
			<div className="text-right">
				<p className="font-semibold tabular-nums text-foreground">
					{estimate.status === "estimated"
						? `${formatQuantity(estimate.totalCostQuantity)} items`
						: "Blocked"}
				</p>
				<p className="mt-1 text-xs tabular-nums text-muted">
					{estimate.runtimeMs === undefined
						? "No runtime estimate"
						: RendererRuntime.runSync(formatItemDurationFx(estimate.runtimeMs))}
				</p>
			</div>
		</header>
		{estimate.status === "no-finite-path" ? (
			<ul className="min-h-0 flex-1 divide-y divide-line/60 overflow-y-auto pr-1">
				{estimate.blockers.map((blocker) => {
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
		) : estimate.cost.length === 0 ? (
			<p className="py-4 text-sm text-muted">No consumed items.</p>
		) : (
			<ul className="min-h-0 flex-1 divide-y divide-line/60 overflow-y-auto pr-1">
				{estimate.cost.map(({ itemId, quantity }) => {
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
		className="min-w-0 rounded-lg border border-l-2 border-line border-l-sky-600 bg-surface-raised p-4"
		data-ui="EditorItemEstimateMethod"
	>
		<header className="flex items-start gap-3 border-b border-line/70 pb-3">
			<span className="icon-[lucide--calculator] mt-0.5 size-5 shrink-0 text-sky-700" />
			<div>
				<h3 className="font-semibold text-foreground">How it is calculated</h3>
				<p className="mt-1 text-xs text-muted">Balanced expected-yield assumptions</p>
			</div>
		</header>
		<p className="py-3 text-xs leading-relaxed text-muted">
			Random output uses its expected yield and required batches are rounded up to whole
			production runs. Time and cost are balanced estimates, not guarantees.
		</p>
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
	const state = useEditorItemEstimate(project, itemId);
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
					<EditorItemEstimateResultCard
						config={project.config}
						estimate={state.estimate}
						projectId={project.projectId}
					/>
					<EditorItemEstimateMethodCard />
				</div>
			) : null}
		</section>
	);
};
