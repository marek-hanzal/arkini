import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type {
	EditorItemEstimate,
	EditorItemEstimateDiagnostic,
} from "~/editor/estimator/EditorItemEstimate";
import type { EditorAcquisitionLimitation } from "~/editor/EditorAcquisitionGraph";
import { formatItemDurationFx } from "~/ui/item-detail/formatItemDurationFx";
import { EditorItemEstimateRouteGraph } from "~/ui/item/editor/EditorItemEstimateRouteGraph";
import { useEditorItemEstimate } from "~/ui/item/editor/useEditorItemEstimate";
import { Status } from "~/ui/status/Status";

const formatQuantity = (quantity: number) =>
	Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/\.00$/, "");

const formatRuntime = (runtimeMs: number) =>
	RendererRuntime.runSync(formatItemDurationFx(runtimeMs));

const diagnosticText = (diagnostic: EditorItemEstimateDiagnostic) => {
	switch (diagnostic.kind) {
		case "quantity-limit-exceeded":
			return `${diagnostic.factId} × ${formatQuantity(diagnostic.quantity)} exceeds the static estimate limit of ${diagnostic.maximumQuantity} (${diagnostic.source}).`;
		case "joint-output-accounting-unsupported":
			return `Correlated output demand on ${diagnostic.routeId} exceeds the bounded static state space.`;
		case "cycle":
			return `Cycle on route ${diagnostic.routeId}: ${diagnostic.factIds.join(" → ")}.`;
		case "unreachable":
			return `${diagnostic.factId} × ${formatQuantity(diagnostic.quantity)} has no complete acquisition route${diagnostic.routeId === undefined ? "" : ` through ${diagnostic.routeId}`}.`;
		case "zero-yield":
			return `Route ${diagnostic.routeId} can never yield ${diagnostic.factId}.`;
	}
};

const limitationText = (limitation: EditorAcquisitionLimitation) => {
	switch (limitation) {
		case "conditional-runtime-adjustments-ignored":
			return "Rules and conditional runtime adjustments are ignored.";
		case "negative-availability-constraints-ignored":
			return "Enable, disable, and availability conditions are ignored.";
		case "spatial-requirements-approximated":
			return "Scope, distance, board capacity, and concrete placement are ignored.";
	}
};

const EditorItemEstimateResultCard = ({ estimate }: { readonly estimate: EditorItemEstimate }) => (
	<article
		className="flex min-h-0 min-w-0 flex-col rounded-lg border border-l-2 border-violet-300 border-l-violet-600 bg-surface-raised p-4"
		data-ui="EditorItemEstimateResult"
	>
		<header className="flex items-start justify-between gap-4 border-b border-line/70 pb-3">
			<div>
				<h3 className="font-semibold text-foreground">
					{estimate.status === "complete"
						? "Complete path found"
						: estimate.status === "partial"
							? "Incomplete static path"
							: "No complete path"}
				</h3>
				<p className="mt-1 text-xs text-muted">
					Target × {formatQuantity(estimate.quantity)}
				</p>
			</div>
			<p className="font-semibold tabular-nums text-foreground">
				{estimate.obtainable
					? formatRuntime(estimate.durationMs)
					: estimate.status === "partial"
						? "Indeterminate"
						: "Unreachable"}
			</p>
		</header>
		{estimate.obtainable ? (
			<div className="min-h-0 flex-1 overflow-y-auto pr-1">
				<section className="py-3 text-xs leading-relaxed text-muted">
					<h4 className="mb-2 font-semibold uppercase tracking-wide text-muted">
						Selected route graph
					</h4>
					<EditorItemEstimateRouteGraph routeSteps={estimate.routeSteps} />
				</section>
			</div>
		) : (
			<div className="grid gap-3 py-4 text-sm leading-relaxed text-muted">
				<p className="font-medium text-foreground">
					{estimate.status === "partial"
						? "The authored path exceeds a bounded static-analysis limit, so totals are indeterminate."
						: "The authored dependency graph contains no complete route from the configured starting facts."}
				</p>
				<ul className="grid gap-2">
					{estimate.diagnostics.map((diagnostic, index) => (
						<li key={`${diagnostic.kind}:${index}`}>{diagnosticText(diagnostic)}</li>
					))}
				</ul>
			</div>
		)}
	</article>
);

const EditorItemEstimateMethodCard = ({ estimate }: { readonly estimate: EditorItemEstimate }) => (
	<article
		className="min-w-0 rounded-lg border border-l-2 border-line border-l-sky-600 bg-surface-raised p-4"
		data-ui="EditorItemEstimateMethod"
	>
		<header className="flex items-start gap-3 border-b border-line/70 pb-3">
			<span className="icon-[lucide--calculator] mt-0.5 size-5 shrink-0 text-sky-700" />
			<div>
				<h3 className="font-semibold text-foreground">Static dependency estimator</h3>
				<p className="mt-1 text-xs text-muted">Optimistic authored-graph analysis</p>
			</div>
		</header>
		<p className="py-3 text-xs leading-relaxed text-muted">
			Compares complete canonical acquisition routes using expected random-output economics
			and serial work. Runtime rules, placement, charge capacity, and finite resource capacity
			are ignored.
		</p>
		<ul className="grid gap-2 border-t border-line/70 pt-3 text-xs leading-relaxed text-muted">
			{estimate.obtainable ? (
				<>
					<li>Selected route: {estimate.route.routeId}.</li>
					<li>
						Expected action runs: {formatQuantity(estimate.route.actionRuns)}; output
						samples: {formatQuantity(estimate.route.outputRuns)}.
					</li>
				</>
			) : (
				<li>
					{estimate.status === "partial"
						? "No duration is claimed for this incomplete path."
						: "No route satisfied every required dependency."}
				</li>
			)}
			<li>Starting authored items contribute no acquisition time.</li>
			<li>Route requirements provide the complete timing explanation.</li>
			{estimate.limitations.map((limitation) => (
				<li key={limitation}>Limitation: {limitationText(limitation)}</li>
			))}
		</ul>
	</article>
);

/** Shows the shared static estimate in one item's read-only Estimate section. */
export const EditorItemEstimateSection = ({ itemId }: { readonly itemId: string }) => {
	const project = useEditorProject();
	const state = useEditorItemEstimate(project, itemId);
	return (
		<section
			className="grid gap-4"
			data-ui="EditorItemEstimateSection"
		>
			<header>
				<h2 className="text-lg font-semibold text-foreground">
					Estimated acquisition path
				</h2>
			</header>
			{state.status === "loading" ? (
				<Status
					dataUi="EditorItemEstimateLoading"
					description="Analyzing authored routes and their requirements."
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
					<EditorItemEstimateResultCard estimate={state.estimate} />
					<EditorItemEstimateMethodCard estimate={state.estimate} />
				</div>
			) : null}
		</section>
	);
};
