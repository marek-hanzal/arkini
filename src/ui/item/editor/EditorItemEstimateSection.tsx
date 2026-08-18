import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type {
	EditorItemEstimate,
	EditorItemEstimateDiagnostic,
} from "~/editor/estimator/EditorItemEstimate";
import type { EditorAcquisitionLimitation } from "~/editor/EditorAcquisitionGraph";
import { EditorInfoTooltip } from "~/ui/form/EditorInfoTooltip";
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
			return "Conditional runtime adjustments are ignored.";
		case "negative-availability-constraints-ignored":
			return "Positive enable prerequisites are acquired, but rule truth and disabling conditions are ignored.";
		case "spatial-requirements-approximated":
			return "Scope, distance, board capacity, and concrete placement are ignored.";
	}
};

const EditorItemEstimateMethodDetails = ({
	estimate,
}: {
	readonly estimate: EditorItemEstimate;
}) => (
	<div
		className="min-w-0"
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
			and an optimistic parallel critical path. Independent dependency branches may overlap;
			positive enable prerequisites still contribute acquisition time. Runtime rule effects,
			placement, charge capacity, and finite resource capacity are ignored.
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
	</div>
);

const EditorItemEstimateHeading = ({ estimate }: { readonly estimate?: EditorItemEstimate }) => (
	<header className="flex items-center gap-1">
		<h2 className="text-lg font-semibold text-foreground">Estimated acquisition path</h2>
		{estimate === undefined ? null : (
			<EditorInfoTooltip
				className="size-7"
				content={<EditorItemEstimateMethodDetails estimate={estimate} />}
				placement="bottom-start"
				tooltipClassName="w-[min(40rem,calc(100vw-2rem))] max-w-none p-4"
			/>
		)}
	</header>
);

const EditorItemEstimateSummary = ({ estimate }: { readonly estimate: EditorItemEstimate }) => (
	<div className="flex min-w-0 flex-1 items-center justify-between gap-4">
		<EditorItemEstimateHeading estimate={estimate} />
		<p className="shrink-0 font-semibold tabular-nums text-foreground">
			{estimate.obtainable
				? formatRuntime(estimate.durationMs)
				: estimate.status === "partial"
					? "Indeterminate"
					: "Unreachable"}
		</p>
	</div>
);

const EditorItemEstimateResult = ({
	config,
	estimate,
	projectId,
}: {
	readonly config: ReturnType<typeof useEditorProject>["config"];
	readonly estimate: EditorItemEstimate;
	readonly projectId: string;
}) =>
	estimate.obtainable ? (
		<EditorItemEstimateRouteGraph
			config={config}
			header={<EditorItemEstimateSummary estimate={estimate} />}
			projectId={projectId}
			routeSteps={estimate.routeSteps}
		/>
	) : (
		<article
			className="rounded-xl border border-line bg-surface-raised p-4"
			data-ui="EditorItemEstimateHeader"
		>
			<EditorItemEstimateSummary estimate={estimate} />
			<div className="mt-4 grid gap-3 border-t border-line/70 pt-4 text-sm leading-relaxed text-muted">
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
			{state.status === "ready" ? null : (
				<div
					className="rounded-xl border border-line bg-surface-raised p-4"
					data-ui="EditorItemEstimateHeader"
				>
					<EditorItemEstimateHeading />
				</div>
			)}
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
				<EditorItemEstimateResult
					config={project.config}
					estimate={state.estimate}
					projectId={project.projectId}
				/>
			) : null}
		</section>
	);
};
