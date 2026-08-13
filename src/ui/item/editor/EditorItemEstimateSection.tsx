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

const formatRuntime = (runtimeMs: number) =>
	RendererRuntime.runSync(formatItemDurationFx(runtimeMs));

const formatProbability = (probability: number) => {
	const percentage = probability * 100;
	if (percentage === 0 || percentage >= 0.01)
		return `${formatQuantity(Number(percentage.toFixed(2)))}%`;
	return `${percentage.toPrecision(2)}%`;
};

type EngineBackedPlanner = NonNullable<EditorItemSimulation["planner"]>;

const formatPlannerActionId = (actionId: string) => {
	try {
		const parsed: unknown = JSON.parse(actionId);
		if (Array.isArray(parsed)) {
			const label = parsed.at(-1);
			if (typeof label === "string") return label;
		}
	} catch {
		// Human-authored or future action IDs remain useful as-is.
	}
	return actionId;
};

const formatRoutePlanOutcome = (
	outcome: EngineBackedPlanner["diagnostics"]["routePlans"][number]["outcome"],
) => {
	switch (outcome) {
		case "completed":
			return "completed";
		case "non-quiescent-runtime":
			return "left a non-quiescent runtime";
		case "search-budget":
			return "hit its search budget";
		case "search-exhausted":
			return "exhausted its candidate frontier";
	}
};

const formatRoutePlanDetour = (
	detour: EngineBackedPlanner["diagnostics"]["routePlans"][number]["detours"][number],
) => {
	const alternative = `${detour.alternativeIndex + 1}/${detour.alternativeCount}`;
	const depth = detour.depthExcess === 0 ? "same depth" : `+${detour.depthExcess} depth`;
	switch (detour.type) {
		case "acquisition-route":
			return `acquire ${detour.itemId} via alternative ${alternative} (${depth})`;
		case "renewal-route":
			return `renew ${detour.itemId} via alternative ${alternative} (${depth})`;
		case "requirement":
			return `satisfy an any-of rule with ${detour.itemId}, alternative ${alternative} (${depth})`;
	}
};

const readRoutePlanDetails = (planner: EngineBackedPlanner): ReadonlyArray<string> => {
	const diagnostics = planner.diagnostics;
	if (diagnostics.attemptedRoutePlans === 0)
		return [
			planner.type === "no-finite-path"
				? "Route plans: none executed; the acquisition graph resolved the target first."
				: planner.type === "completed"
					? "Route plans: no engine pass was required because the target was already available."
					: "Route plans: no engine pass was executed before the search stopped.",
		];

	const winner = diagnostics.winningRoutePlanIndex;
	const details: string[] = [
		`Route plans: ${formatQuantity(diagnostics.attemptedRoutePlans)} tried${winner === undefined ? "; no plan completed" : `; plan ${winner} completed`}.`,
	];
	const failedPlans = diagnostics.routePlans.filter(({ index }) => index !== winner);
	for (const attempt of failedPlans.slice(0, 2)) {
		const furthestAction = attempt.bestTraceActionIds.at(-1);
		details.push(
			`Plan ${attempt.index}: ${formatRoutePlanOutcome(attempt.outcome)} after ${formatQuantity(attempt.expandedStates)} expanded states; best target quantity ${formatQuantity(attempt.bestAvailableQuantity)}${furthestAction === undefined ? "" : `; trace reached ${formatPlannerActionId(furthestAction)}`}.`,
		);
	}
	if (failedPlans.length > 2)
		details.push(`${formatQuantity(failedPlans.length - 2)} additional failed plans omitted.`);

	const winningPlan = diagnostics.routePlans.find(({ index }) => index === winner);
	if (winningPlan !== undefined)
		if (winningPlan.detours.length === 0)
			details.push("Winning plan used the locally shortest authored route choices.");
		else {
			const rendered = winningPlan.detours.slice(0, 2).map(formatRoutePlanDetour);
			details.push(
				`Winning detour: ${rendered.join("; ")}${winningPlan.detours.length > 2 ? `; ${winningPlan.detours.length - 2} more` : ""}.`,
			);
		}
	return details;
};

const EditorItemEstimateResultCard = ({
	config,
	estimate,
	projectId,
}: {
	readonly config: ReturnType<typeof useEditorProject>["config"];
	readonly estimate: EditorItemSimulation;
	readonly projectId: string;
}) => {
	const summary = (() => {
		switch (estimate.status) {
			case "estimated":
				return {
					detail: `${estimate.cost.length} consumed item types`,
					title: "Expected",
					value: `${formatQuantity(estimate.totalCostQuantity)} items`,
				};
			case "no-finite-path":
				return {
					detail: `${estimate.blockers.length} production ${estimate.blockers.length === 1 ? "blocker" : "blockers"}`,
					title: "No finite production path found",
					value: "Blocked",
				};
			case "inconclusive":
				return {
					detail: "Bounded search could not decide",
					title: "Estimate inconclusive",
					value: "Undecided",
				};
		}
	})();
	return (
		<article
			className="flex min-h-0 min-w-0 flex-col rounded-lg border border-l-2 border-violet-300 border-l-violet-600 bg-surface-raised p-4"
			data-ui="EditorItemEstimateResult"
		>
			<header className="flex items-start justify-between gap-4 border-b border-line/70 pb-3">
				<div>
					<h3 className="font-semibold text-foreground">{summary.title}</h3>
					<p className="mt-1 text-xs text-muted">{summary.detail}</p>
				</div>
				<div className="text-right">
					<p className="font-semibold tabular-nums text-foreground">{summary.value}</p>
					<p className="mt-1 text-xs tabular-nums text-muted">
						{estimate.runtimeMs === undefined
							? estimate.status === "inconclusive"
								? "No reliable runtime estimate"
								: "No runtime estimate"
							: formatRuntime(estimate.runtimeMs)}
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
								<p className="text-xs leading-relaxed text-muted">
									{blocker.message}
								</p>
								{blocker.operationId === undefined ? null : (
									<code className="text-[0.6875rem] text-muted">
										{blocker.operationId}
									</code>
								)}
							</li>
						);
					})}
				</ul>
			) : estimate.status === "inconclusive" ? (
				<div className="grid gap-3 py-4 text-sm leading-relaxed text-muted">
					<p className="font-medium text-foreground">
						This is not proof that the item is impossible.
					</p>
					{estimate.warnings.map((warning) => (
						<p key={warning}>{warning}</p>
					))}
				</div>
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
};

const EditorItemEstimateMethodCard = ({
	estimate,
}: {
	readonly estimate: EditorItemSimulation;
}) => {
	const planner = estimate.planner;
	const content = (() => {
		if (planner?.type === "completed")
			return {
				description:
					planner.outputCertainty === "deterministic"
						? "The real engine completed a deterministic production witness."
						: "The real engine completed one positive-probability production witness.",
				details: [
					`Concrete witness: ${formatQuantity(planner.observedActionRuns)} actions, ${formatRuntime(planner.observedRuntimeMs)}.`,
					`Expected replay: ${formatQuantity(planner.expectedActionRuns)} actions${estimate.runtimeMs === undefined ? "" : `, ${formatRuntime(estimate.runtimeMs)}`}.`,
					...(planner.outputCertainty === "possible"
						? [
								`Selected witness probability: ${formatProbability(planner.selectedWitnessProbability)}.`,
							]
						: []),
					...(planner.expectedSpentCharges.length === 0
						? []
						: [
								`Expected charge spend: ${formatQuantity(planner.expectedSpentCharges.reduce((total, entry) => total + entry.charges, 0))}.`,
							]),
					`Search: ${formatQuantity(planner.expandedStates)} expanded, ${formatQuantity(planner.visitedStates)} visited states.`,
					...readRoutePlanDetails(planner),
				],
				subtitle:
					planner.outputCertainty === "deterministic"
						? "Deterministic witness"
						: "Positive-probability witness",
				title: "Engine-backed planner",
			};
		if (planner?.type === "no-finite-path")
			return {
				description:
					"The optimistic acquisition graph still has no reachable authored route. This is a structural impossibility proof, not a search timeout.",
				details: [
					`Proof: ${planner.proofType === "target-missing" ? "target is missing from config" : "no finite authored path"}.`,
					...readRoutePlanDetails(planner),
				],
				subtitle: "Graph-certified result",
				title: "No finite path",
			};
		if (planner?.type === "inconclusive")
			return {
				description:
					"The engine search stopped without a witness and without a structural impossibility proof. Treat this as undecided.",
				details: [
					`Best target quantity: ${formatQuantity(planner.bestAvailableQuantity)}.`,
					`Search: ${formatQuantity(planner.expandedStates)} expanded, ${formatQuantity(planner.visitedStates)} visited states.`,
					...(planner.budgetLimit === undefined
						? []
						: [
								`Budget limit: ${planner.budgetLimit}.`,
							]),
					...readRoutePlanDetails(planner),
				],
				subtitle: "Undecided, not impossible",
				title: "Bounded engine search",
			};
		return {
			description:
				"Random output uses its expected yield and required batches are rounded up to whole production runs. Time and cost are estimates, not guarantees.",
			details: [
				"Production, line rules, drop rules, runtime modifiers, and charges are simulated.",
				"Finite deposits block the path unless gameplay output can recreate them.",
				"All gameplay operations are scheduled sequentially.",
				"Starting items on the configured current board cost no added runtime.",
			],
			subtitle: "Balanced expected-yield assumptions",
			title: "How it is calculated",
		};
	})();
	return (
		<article
			className="min-w-0 rounded-lg border border-l-2 border-line border-l-sky-600 bg-surface-raised p-4"
			data-ui="EditorItemEstimateMethod"
		>
			<header className="flex items-start gap-3 border-b border-line/70 pb-3">
				<span className="icon-[lucide--calculator] mt-0.5 size-5 shrink-0 text-sky-700" />
				<div>
					<h3 className="font-semibold text-foreground">{content.title}</h3>
					<p className="mt-1 text-xs text-muted">{content.subtitle}</p>
				</div>
			</header>
			<p className="py-3 text-xs leading-relaxed text-muted">{content.description}</p>
			<ul className="grid gap-2 border-t border-line/70 pt-3 text-xs leading-relaxed text-muted">
				{content.details.map((detail) => (
					<li key={detail}>{detail}</li>
				))}
				<li>Spatial relations and physical capacity remain optimistic planner policies.</li>
			</ul>
		</article>
	);
};

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
					<EditorItemEstimateMethodCard estimate={state.estimate} />
				</div>
			) : null}
		</section>
	);
};
