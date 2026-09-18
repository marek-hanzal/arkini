import { formatForDisplay } from "@tanstack/react-hotkeys";
import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";
import { TriangleAlert, Unlink } from "lucide-react";
import { useState } from "react";

import { useSectionShortcuts } from "~/ui/ui/useSectionShortcuts";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { ItemEstimate, ItemEstimateDiagnostic } from "~/estimate/type/ItemEstimate";
import { formatItemEstimateResultFn } from "~/estimate/ui/formatItemEstimateResultFn";
import {
	ItemEstimateRouteGraph,
	type ItemEstimateSort,
} from "~/estimate/ui/ItemEstimateRouteGraph";
import { ItemEstimateLoading } from "~/estimate/ui/ItemEstimateLoading";
import { useItemEstimate } from "~/estimate/ui/useItemEstimate";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { SegmentedControl } from "~/ui/ui/SegmentedControl";
import { Status } from "~/ui/ui/Status";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { useTranslator } from "~/translation/ui/useTranslator";

const formatQuantityFn = (quantity: number) =>
	Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/\.00$/, "");

const diagnosticTextFn = (diagnostic: ItemEstimateDiagnostic, textFn: (key: string) => string) => {
	switch (diagnostic.kind) {
		case "weighted-clock-pool-unsupported":
			return textFn(
				"{routeId} depends on weighted Clock alternatives whose shared pulse timing static Estimate cannot resolve.",
			).replace("{routeId}", diagnostic.routeId);
		case "finite-owner-lifetime-unsupported":
			return textFn(
				"{routeId} depends on finite owner lifetime and production settlement, which static Estimate cannot resolve.",
			).replace("{routeId}", diagnostic.routeId);
		case "joint-output-accounting-unsupported":
			return textFn(
				"{routeId} exceeds the bounded joint-output accounting state space.",
			).replace("{routeId}", diagnostic.routeId);
		case "witness-search-exhausted":
			return textFn(
				"{routeId} exceeds the bounded complete-witness search of {maximumStates} states.",
			)
				.replace("{routeId}", diagnostic.routeId)
				.replace("{maximumStates}", String(diagnostic.maximumStates));
		case "quantity-limit-exceeded":
			return textFn(
				"{factId} × {quantity} exceeds the static estimate limit of {maximumQuantity} ({source}).",
			)
				.replace("{factId}", diagnostic.factId)
				.replace("{quantity}", formatQuantityFn(diagnostic.quantity))
				.replace("{maximumQuantity}", String(diagnostic.maximumQuantity))
				.replace("{source}", diagnostic.source);
		case "cycle":
			return textFn("Cycle on route {routeId}: {factIds}.")
				.replace("{routeId}", diagnostic.routeId)
				.replace("{factIds}", diagnostic.factIds.join(" → "));
		case "unreachable":
			return (
				diagnostic.routeId === undefined
					? textFn("{factId} × {quantity} has no complete acquisition route.")
					: textFn(
							"{factId} × {quantity} has no complete acquisition route through {routeId}.",
						).replace("{routeId}", diagnostic.routeId)
			)
				.replace("{factId}", diagnostic.factId)
				.replace("{quantity}", formatQuantityFn(diagnostic.quantity));
		case "zero-yield":
			return textFn("Route {routeId} can never yield {factId}.")
				.replace("{routeId}", diagnostic.routeId)
				.replace("{factId}", diagnostic.factId);
	}
};

const ItemEstimateSummary = ({ estimate }: { readonly estimate: ItemEstimate }) => (
	<p className="shrink-0 font-semibold tabular-nums text-foreground">
		{estimate.obtainable ? (
			formatItemEstimateResultFn(estimate)
		) : (
			<Tx label={estimate.status === "partial" ? "Indeterminate" : "Unreachable"} />
		)}
	</p>
);

const ItemEstimateResult = ({
	config,
	estimate,
	limit,
	sort,
}: {
	readonly config: GameConfigSchema.Type;
	readonly estimate: ItemEstimate;
	readonly limit?: number;
	readonly sort: ItemEstimateSort;
}) => {
	const translator = useTranslator();
	return estimate.status === "unreachable" ? (
		limit === undefined ? (
			<Status
				dataUi="EditorItemEstimateUnreachable"
				icon={Unlink}
				title={<Tx label="This item is unreachable." />}
				description={<Mx label="Estimate unreachable description" />}
				size="large"
				variant="flat"
			/>
		) : (
			<EditorRootCard dataUi="EditorItemEstimateUnreachableCard">
				<Status
					dataUi="EditorItemEstimateUnreachable"
					icon={Unlink}
					title={<Tx label="This item is unreachable." />}
					variant="flat"
				/>
			</EditorRootCard>
		)
	) : estimate.obtainable ? (
		<ItemEstimateRouteGraph
			config={config}
			limit={limit}
			routeSteps={estimate.routeSteps}
			sort={sort}
		/>
	) : (
		<EditorRootCard dataUi="EditorItemEstimateDiagnostics">
			{limit === undefined ? null : <ItemEstimateSummary estimate={estimate} />}
			<div className="grid gap-3 text-sm leading-relaxed text-muted">
				<Mx label="Estimate incomplete description" />
				<ul className="grid gap-2">
					{estimate.diagnostics.slice(0, limit).map((diagnostic, index) => (
						<li key={`${diagnostic.kind}:${index}`}>
							{diagnosticTextFn(diagnostic, translator.textFn)}
						</li>
					))}
				</ul>
			</div>
		</EditorRootCard>
	);
};

/** Shares the captured estimate between the full section and its two-entry overview. */
export const ItemEstimateSection = ({
	itemId,
	previewItemUid,
}: {
	readonly itemId: string;
	readonly previewItemUid?: string;
}) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const state = useItemEstimate(project, itemId);
	const [sort, setSortFn] = useState<ItemEstimateSort>("time");
	// Item Detail owns every letter in Time, including E for Edit; nested sorting uses Shift.
	const sortOptions = [
		{
			label: translator.textFn("Time"),
			value: "time",
			shortcut: "t",
			shift: true,
		},
		{
			label: translator.textFn("Quantity"),
			value: "quantity",
			shortcut: "q",
			shift: true,
		},
	] as const;
	useSectionShortcuts({
		enabled: previewItemUid === undefined,
		options: sortOptions,
		onSelectFn: (option) => setSortFn(option.value),
	});
	const headerAction =
		state.status === "ready" ? (
			<div className="flex items-center gap-3">
				<ItemEstimateSummary estimate={state.estimate} />
				{state.estimate.obtainable ? (
					<SegmentedControl
						dataUi="EditorItemEstimateRouteSortOptions"
						onChangeFn={setSortFn}
						optionDataUi="EditorItemEstimateRouteSort"
						options={sortOptions.map((option) => ({
							...option,
							description: `${option.label} · ${formatForDisplay({
								key: option.shortcut,
								shift: option.shift,
							})}`,
						}))}
						size="compact"
						value={sort}
					/>
				) : null}
			</div>
		) : undefined;
	return (
		<section
			className="grid content-start gap-4 data-[ui-unreachable=true]:content-stretch"
			{...readDataUiFn({
				dataUi: "EditorItemEstimateSection",
				state: {
					unreachable:
						state.status === "ready" && state.estimate.status === "unreachable",
				},
			})}
		>
			{previewItemUid === undefined ? (
				<div data-ui="EditorItemEstimateHeader">
					<EditorFormSectionDivider
						action={headerAction}
						title={translator.textFn("Estimate")}
					/>
				</div>
			) : null}
			{state.status === "loading" ? <ItemEstimateLoading /> : null}
			{state.status === "error" ? (
				<Status
					dataUi="EditorItemEstimateError"
					description={state.message}
					icon={TriangleAlert}
					title={<Tx label="Estimate calculation failed" />}
				/>
			) : null}
			{state.status === "ready" ? (
				<ItemEstimateResult
					config={state.config}
					estimate={state.estimate}
					limit={previewItemUid === undefined ? undefined : 2}
					sort={sort}
				/>
			) : null}
		</section>
	);
};
