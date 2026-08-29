import { Calculator, Info, LoaderCircle, TriangleAlert } from "lucide-react";

import { useEditorProject } from "~/ui/editor/useEditorProject";
import { RendererRuntime } from "~/renderer/RendererRuntime";
import type {
	EditorItemEstimate,
	EditorItemEstimateDiagnostic,
} from "~/editor/estimator/EditorItemEstimate";
import type { EditorAcquisitionLimitation } from "~/editor/EditorAcquisitionGraph";
import { formatItemDurationFx } from "~/ui/item-detail/formatItemDurationFx";
import { EditorItemEstimateRouteGraph } from "~/ui/item/editor/EditorItemEstimateRouteGraph";
import { useEditorItemEstimate } from "~/ui/item/editor/useEditorItemEstimate";
import { Tooltip } from "~/ui/overlay/Tooltip";
import { Status } from "~/ui/status/Status";

const formatQuantity = (quantity: number) =>
	Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/\.00$/, "");

const formatRuntime = (runtimeMs: number) =>
	RendererRuntime.runSync(formatItemDurationFx(runtimeMs));

const diagnosticText = (diagnostic: EditorItemEstimateDiagnostic) => {
	switch (diagnostic.kind) {
		case "quantity-limit-exceeded":
			return `${diagnostic.factId} × ${formatQuantity(diagnostic.quantity)} exceeds the static estimate limit of ${diagnostic.maximumQuantity} (${diagnostic.source}).`;
		case "quantity-specific-route-not-retried":
			return `${diagnostic.factId} × ${formatQuantity(diagnostic.quantity)} exceeds selected scalar route ${diagnostic.routeId}; quantity-specific alternatives were not retried.`;
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
			<Calculator className="mt-0.5 size-5 shrink-0 text-sky-700" />
			<div>
				<h3 className="font-semibold text-foreground">Approximate dependency estimator</h3>
				<p className="mt-1 text-xs text-muted">Optimistic scalar authored-graph analysis</p>
			</div>
		</header>
		<p className="py-3 text-xs leading-relaxed text-muted">
			Expands from authored starting facts and records the first locally ranked route when
			each fact becomes reachable. Ranking uses scalar action time with stable route identity
			as the tie-break; demand is divided by scalar expected yield. The materialized witness
			is timed as an optimistic parallel critical path. Equivalent independent route
			occurrences are compressed into one row; shared outputs, shared finite roots, runtime
			rule effects, placement, charge capacity, renewal, and finite resource capacity are not
			simulated. Route admission proves one scalar output unit; larger propagated demand can
			return partial without retrying quantity-specific alternatives.
		</p>
		<ul className="grid gap-2 border-t border-line/70 pt-3 text-xs leading-relaxed text-muted">
			{estimate.obtainable ? (
				<>
					<li>Selected route: {estimate.route.routeId}.</li>
					<li>
						Approximate action runs: {formatQuantity(estimate.route.actionRuns)}; output
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
			<li>Route occurrences provide the deterministic approximation explanation.</li>
			{estimate.obtainable && estimate.diagnostics.length > 0 ? (
				<li>
					Rejected alternatives:{" "}
					{estimate.diagnostics.map((diagnostic) => diagnosticText(diagnostic)).join(" ")}
				</li>
			) : null}
			{estimate.limitations.map((limitation) => (
				<li key={limitation}>Limitation: {limitationText(limitation)}</li>
			))}
		</ul>
	</div>
);

const EditorItemEstimateHeading = ({ estimate }: { readonly estimate?: EditorItemEstimate }) => (
	<header className="flex items-center gap-1">
		<h2 className="text-lg font-semibold text-foreground">Approximate acquisition path</h2>
		{estimate === undefined ? null : (
			<Tooltip
				content={<EditorItemEstimateMethodDetails estimate={estimate} />}
				contentClassName="w-[min(40rem,calc(100vw-2rem))] max-w-none p-4"
				placement="bottom-start"
			>
				<button
					type="button"
					data-ui="EditorInfoTooltip"
					className="grid size-7 min-h-0 min-w-0 shrink-0 cursor-help place-items-center rounded-full border-0 bg-transparent p-0 text-muted hover:text-foreground"
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
					}}
				>
					<Info className="size-4" />
				</button>
			</Tooltip>
		)}
	</header>
);

const EditorItemEstimateSummary = ({ estimate }: { readonly estimate: EditorItemEstimate }) => (
	<div className="flex min-w-0 flex-1 items-center justify-between gap-4">
		<EditorItemEstimateHeading estimate={estimate} />
		<p className="shrink-0 font-semibold tabular-nums text-foreground">
			{estimate.obtainable
				? `≈ ${formatRuntime(estimate.durationMs)}`
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
						? "The requested path exceeded either the static-analysis limit or its selected scalar-unit witness, so totals are indeterminate."
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
					icon={LoaderCircle}
					iconSpin
					title="Calculating estimate"
				/>
			) : null}
			{state.status === "error" ? (
				<Status
					dataUi="EditorItemEstimateError"
					description={state.message}
					icon={TriangleAlert}
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
