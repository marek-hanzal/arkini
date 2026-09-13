import { useMemo } from "react";
import { ArrowRight, Clock, GitBranch } from "lucide-react";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { readItemChainsFn } from "~/item-chain/fn/readItemChainsFn";
import { ButtonLink } from "~/ui/ui/Button";
import { Status } from "~/ui/ui/Status";
import { useTranslator } from "~/translation/ui/useTranslator";

const stopLabels = {
	final: "Final item",
	retained: "Remains",
	spent: "Spends one unit",
	cycle: "Clock loop",
	depth: "Depth limit",
	missing: "Missing item",
	ongoing: "No finite lifetime",
	"no-output": "No items emitted",
} as const;
const quantityFn = (quantity: { readonly min: number; readonly max: number }) =>
	quantity.min === quantity.max ? `×${quantity.min}` : `×${quantity.min}–${quantity.max}`;
const durationFn = (ms: number) =>
	ms >= 60000 ? `${Math.round(ms / 600) / 100} min` : `${Math.round(ms / 10) / 100} s`;

export const ItemChain = ({ itemId }: { readonly itemId: string }) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const projection = useMemo(
		() => readItemChainsFn(project.config.items, itemId),
		[
			project.config.items,
			itemId,
		],
	);
	return (
		<section
			data-ui="EditorItemChain"
			className="flex flex-col gap-4"
		>
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
							<div className="flex flex-wrap justify-end gap-3">
								{chain.outcomes.length > 0 &&
								chain.outcomes.every((outcome) => outcome.stop === "no-output") ? (
									<p className="text-sm font-bold">
										{translator.textFn("No items emitted")}
									</p>
								) : null}
								{chain.outcomes
									.filter((outcome) => outcome.stop !== "no-output")
									.map((outcome, index) => (
										<div
											key={index}
											className="rounded-lg border border-line p-2"
											data-ui="EditorChainOutcome"
										>
											{outcome.itemId === undefined ? null : (
												<ItemReference
													itemId={outcome.itemId}
													sectionId="chain"
												/>
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
							{translator.textFn("Details")}
						</summary>
						<div className="mt-3 flex flex-col gap-3">
							{chain.steps.map((step) => (
								<ChainStep
									key={step.path}
									step={step}
								/>
							))}
						</div>
					</details>
				</EditorRootCard>
			))}
		</section>
	);
};

const ItemReference = ({
	itemId,
	sectionId = "identity",
}: {
	readonly itemId: string;
	readonly sectionId?: "identity" | "chain";
}) => {
	const project = useEditorProject();
	const item = project.config.items[itemId];
	if (item === undefined) return <span className="text-muted">{itemId}</span>;
	return (
		<ButtonLink
			to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
			params={{
				projectId: project.projectId,
				itemUid: item.uid,
				sectionId,
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

const ChainStep = ({ step }: { readonly step: readItemChainsFn.Step }) => {
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
						className="border-l-2 border-accent pl-24"
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
								/>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
};
