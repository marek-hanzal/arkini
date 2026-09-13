import { useMemo, useState } from "react";
import { ArrowRight, Clock, GitBranch } from "lucide-react";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { EditorSelect } from "~/editor-control/ui/EditorSelect";
import { readItemChainsFn } from "~/item-chain/fn/readItemChainsFn";
import { ButtonLink } from "~/ui/ui/Button";
import { LinkButton } from "~/ui/ui/LinkButton";
import { Status } from "~/ui/ui/Status";
import { useTranslator } from "~/translation/ui/useTranslator";

const stopLabels = {
	final: "Final item",
	retained: "Remains",
	spent: "Spends one unit",
	cycle: "Clock loop",
	depth: "Depth limit",
	manual: "Stopped here",
	missing: "Missing item",
	ongoing: "No finite lifetime",
	"no-output": "No items emitted",
} as const;
const quantityFn = (quantity: { readonly min: number; readonly max: number }) =>
	quantity.min === quantity.max ? `×${quantity.min}` : `×${quantity.min}–${quantity.max}`;
const durationFn = (ms: number) =>
	ms >= 60000 ? `${Math.round(ms / 600) / 100} min` : `${Math.round(ms / 10) / 100} s`;

/** Shared item/global Chain exploration; changing the root resets branch-local decisions. */
export const ItemChain = ({ itemId }: { readonly itemId: string }) => (
	<ChainExplorer
		key={itemId}
		itemId={itemId}
	/>
);

const ChainExplorer = ({ itemId }: { readonly itemId: string }) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const [depth, setDepthFn] = useState("5");
	const [stopSelection, setStopSelectionFn] = useState({
		items: project.config.items,
		paths: new Set<string>(),
	});
	const stopped = useMemo(
		() =>
			stopSelection.items === project.config.items ? stopSelection.paths : new Set<string>(),
		[
			stopSelection,
			project.config.items,
		],
	);
	const projection = useMemo(
		() => readItemChainsFn(project.config.items, itemId, Number(depth), stopped),
		[
			project.config.items,
			itemId,
			depth,
			stopped,
		],
	);
	const toggleStopFn = (path: string) =>
		setStopSelectionFn(() => {
			const next = new Set(stopped);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			return {
				items: project.config.items,
				paths: next,
			};
		});
	return (
		<section
			data-ui="EditorItemChain"
			className="flex flex-col gap-4"
		>
			<EditorRootCard dataUi="EditorChainControls">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div className="min-w-0 flex-1">
						<p className="font-semibold">{translator.textFn("Chain")}</p>
						<p className="mt-1 text-sm text-muted">
							{translator.textFn("Chain introduction")}
						</p>
					</div>
					<EditorSelect
						label={translator.textFn("Maximum steps")}
						value={depth}
						onChangeFn={setDepthFn}
						options={[
							1,
							2,
							3,
							4,
							5,
							8,
							12,
						].map((value) => ({
							value: String(value),
							label: String(value),
						}))}
					/>
					{stopped.size === 0 ? null : (
						<LinkButton
							onClick={() =>
								setStopSelectionFn({
									items: project.config.items,
									paths: new Set(),
								})
							}
						>
							{translator.textFn("Reset branch stops")}
						</LinkButton>
					)}
				</div>
			</EditorRootCard>
			{projection.truncated ? (
				<p className="text-sm text-muted">{translator.textFn("Chain safety limit")}</p>
			) : null}
			{projection.chains.length === 0 ? (
				<Status
					icon={GitBranch}
					title={translator.textFn("No chains for this item")}
					description={translator.textFn("Chain empty description")}
					size="large"
					variant="flat"
				/>
			) : null}
			{projection.chains.map((chain) => (
				<EditorRootCard
					key={chain.id}
					dataUi="EditorChainCard"
				>
					<div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
						<div className="flex min-w-0 flex-col gap-2">
							<ItemReference itemId={chain.ownerId} />
							{chain.targetId === undefined ? (
								<span className="inline-flex items-center gap-2 text-sm text-muted">
									<Clock className="size-4" />
									{translator.textFn("Clock")}
								</span>
							) : (
								<>
									<span className="text-sm text-muted">
										{translator.textFn("Drop onto")}
									</span>
									<ItemReference itemId={chain.targetId} />
								</>
							)}
						</div>
						<ArrowRight className="size-5 text-muted" />
						<div className="min-w-0 max-w-full justify-self-end">
							<p className="mb-2 text-right text-sm font-semibold">
								{translator.textFn("Possible results")}
							</p>
							<div className="flex flex-wrap justify-end gap-3">
								{chain.outcomes.map((outcome, index) => (
									<div
										key={index}
										className="rounded-lg border border-line p-2"
										data-ui="EditorChainOutcome"
									>
										{outcome.itemId === undefined ? null : (
											<ItemReference itemId={outcome.itemId} />
										)}
										<p className="mt-1 text-xs text-muted">
											{translator.textFn(stopLabels[outcome.stop])}
											{outcome.periodic
												? ` · ${translator.textFn("Repeated output")}`
												: ""}
											{outcome.conditional
												? ` · ${translator.textFn("Conditional or alternative")}`
												: ""}
										</p>
										{outcome.itemId === undefined ? null : (
											<ButtonLink
												className="mt-1 min-h-0 border-0 bg-transparent p-0 text-xs text-accent shadow-none"
												to="/editor/$projectId/chains"
												params={{
													projectId: project.projectId,
												}}
												search={{
													itemId: outcome.itemId,
												}}
											>
												{translator.textFn("Explore from here")}
											</ButtonLink>
										)}
									</div>
								))}
							</div>
						</div>
					</div>
					<details
						className="mt-4 border-t border-line pt-3"
						data-ui="EditorChainSteps"
					>
						<summary className="cursor-pointer text-sm font-semibold text-accent">
							{translator.textFn("Show steps and quantities")}
						</summary>
						<div className="mt-3 flex flex-col gap-3">
							{chain.steps.map((step) => (
								<ChainStep
									key={step.path}
									step={step}
									onStopFn={toggleStopFn}
								/>
							))}
						</div>
					</details>
				</EditorRootCard>
			))}
		</section>
	);
};

const ItemReference = ({ itemId }: { readonly itemId: string }) => {
	const project = useEditorProject();
	const item = project.config.items[itemId];
	if (item === undefined) return <span className="text-muted">{itemId}</span>;
	return (
		<ButtonLink
			to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
			params={{
				projectId: project.projectId,
				itemUid: item.uid,
				sectionId: "identity",
			}}
			search={{}}
			className="min-h-0 max-w-full justify-start gap-2 border-0 bg-transparent p-0 text-left text-sm shadow-none hover:bg-transparent hover:text-accent"
		>
			<EditorItemThumbnail
				resourceIds={item.asset.default}
				size="input"
			/>
			<span className="min-w-0 break-words">{item.title}</span>
		</ButtonLink>
	);
};

const ChainStep = ({
	step,
	onStopFn,
}: {
	readonly step: readItemChainsFn.Step;
	readonly onStopFn: (path: string) => void;
}) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const owner = project.config.items[step.ownerId];
	const title =
		step.kind === "merge"
			? `${translator.textFn("Merge")} ${(step.mergeIndex ?? 0) + 1}`
			: step.kind === "expiry"
				? translator.textFn("Clock expiry")
				: `${translator.textFn("Clock line")} · ${step.lineTitle}`;
	return (
		<div
			className="py-3"
			data-ui="EditorChainStep"
		>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
				{owner === undefined ? (
					<strong>{title}</strong>
				) : (
					<ButtonLink
						to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"
						params={{
							projectId: project.projectId,
							itemUid: owner.uid,
							sectionId:
								step.kind === "merge"
									? "merges"
									: step.kind === "pulse"
										? "production"
										: "clock",
						}}
						search={{
							merge: step.mergeIndex,
							lineId: step.lineId,
						}}
						className="min-h-0 border-0 bg-transparent p-0 text-sm text-accent shadow-none"
					>
						{owner.title} · {title}
					</ButtonLink>
				)}
				{step.timeMs === undefined ? null : (
					<span>
						{translator.textFn(step.kind === "pulse" ? "Every" : "After")}{" "}
						{durationFn(step.timeMs)}
					</span>
				)}
				{step.kind !== "pulse" ? null : (
					<span className="text-muted">
						{translator.textFn("Line duration")}: {durationFn(step.runtimeMs ?? 0)} ·{" "}
						{step.lifetimeMs === undefined
							? translator.textFn("No finite lifetime")
							: `${translator.textFn("Lifetime")}: ${durationFn(step.lifetimeMs)}`}
					</span>
				)}
				{step.disabled ? (
					<span className="text-muted">{translator.textFn("Disabled by default")}</span>
				) : null}
				{step.conditional ? (
					<span className="text-muted">{translator.textFn("Depends on conditions")}</span>
				) : null}
				{step.inputCount === 0 ? null : (
					<span className="text-muted">
						{translator.textFn("Inputs")}: {step.inputCount}
					</span>
				)}
			</div>
			{step.kind !== "merge" ? null : (
				<p className="mt-1 text-xs text-muted">
					{translator.textFn("Source")}: {step.sourceAction} ·{" "}
					{translator.textFn("Target")}: {step.targetEffect}
				</p>
			)}
			{step.kind !== "pulse" ? null : (
				<p className="mt-1 text-xs text-muted">
					{translator.textFn("Chain pulse explanation")}
				</p>
			)}
			<div className="mt-3 flex flex-col gap-3">
				{step.branches.length === 0 && !step.incomplete ? (
					<p className="text-sm text-muted">{translator.textFn("No items emitted")}</p>
				) : null}
				{step.branches.map((node) => (
					<div
						key={node.path}
						className="border-l-2 border-line pl-3"
						data-ui="EditorChainBranch"
					>
						<div className="flex flex-wrap items-center gap-2">
							<ItemReference itemId={node.itemId} />
							{node.quantity === undefined ? null : (
								<span className="text-sm">{quantityFn(node.quantity)}</span>
							)}
							{node.stop === undefined ? null : (
								<span className="text-xs text-muted">
									{translator.textFn(stopLabels[node.stop])}
								</span>
							)}
							{node.steps.length === 0 && node.stop !== "manual" ? null : (
								<LinkButton
									className="min-h-0 p-0 text-xs"
									onClick={() => onStopFn(node.path)}
								>
									{translator.textFn(
										node.stop === "manual" ? "Continue branch" : "Stop here",
									)}
								</LinkButton>
							)}
						</div>
						{node.output === undefined ? null : (
							<p className="mt-1 text-xs text-muted">
								{translator.textFn(
									node.output.alternative ? "Alternative set" : "Output set",
								)}{" "}
								{node.output.set + 1}
								{node.output.alternative
									? ` (${translator.textFn("Weight")} ${node.output.setWeight})`
									: ""}
								{` · ${translator.textFn("Roll")} ${node.output.roll + 1} · `}
								{node.output.type === "chance"
									? `${(node.output.chance ?? 0) * 100}%`
									: translator.textFn(
											node.output.type === "weight"
												? "Weighted"
												: "Guaranteed",
										)}
								{node.output.candidate === undefined
									? ""
									: ` · ${translator.textFn("Candidate")} ${node.output.candidate + 1} (${translator.textFn("Weight")} ${node.output.weight})`}
								{node.output.selections === undefined
									? ""
									: ` · ${translator.textFn("Selections")} ${quantityFn(node.output.selections)}`}
								{node.output.conditional
									? ` · ${translator.textFn("Depends on conditions")}`
									: ""}
							</p>
						)}
						<div className="mt-2 flex flex-col gap-2">
							{node.steps.map((child) => (
								<ChainStep
									key={child.path}
									step={child}
									onStopFn={onStopFn}
								/>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
};
