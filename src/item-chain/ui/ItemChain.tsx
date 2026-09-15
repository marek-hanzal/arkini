import { Mx } from "~/translation/ui/Mx";
import { type ReactNode, useMemo } from "react";
import { ArrowRight, Clock, GitBranch, Plus } from "lucide-react";
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
			{projection.truncated ? <Mx label="Chain safety limit" /> : null}
			{projection.chains.length === 0 ? (
				<Status
					icon={GitBranch}
					title={translator.textFn("No chains for this item")}
					description={<Mx label="Chain empty description" />}
					size="large"
					variant="flat"
				/>
			) : null}
			{projection.chains.map((chain) => (
				<EditorRootCard
					key={chain.id}
					className="border-b border-line pb-4 last:border-b-0 last:pb-0"
					dataUi="EditorChainCard"
				>
					<div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-4">
						<div className="flex min-w-0 flex-col gap-2">
							{chain.targetId === undefined ? (
								<ItemReference
									description={
										<span className="inline-flex items-center gap-2 text-sm text-muted">
											<Clock className="size-4" />
											{translator.textFn("Clock")}
										</span>
									}
									itemId={chain.ownerId}
								/>
							) : (
								<div className="flex min-w-0 flex-wrap items-center gap-3">
									<ItemReference itemId={chain.ownerId} />
									<Plus className="size-4 shrink-0 text-muted" />
									<ItemReference itemId={chain.targetId} />
								</div>
							)}
						</div>
						<ArrowRight className="size-5 self-center text-muted" />
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
										<ChainOutcome
											key={index}
											outcome={outcome}
										/>
									))}
							</div>
						</div>
					</div>
					<details
						className="mt-4"
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

const ChainOutcome = ({ outcome }: { readonly outcome: readItemChainsFn.Outcome }) => {
	const translator = useTranslator();
	const description = (
		<span className="text-xs font-normal text-muted">
			{translator.textFn(stopLabels[outcome.stop])}
			{outcome.periodic ? ` · ${translator.textFn("Repeated output")}` : ""}
			{outcome.conditional ? ` · ${translator.textFn("Conditional or alternative")}` : ""}
		</span>
	);
	return (
		<div
			className="p-2"
			data-ui="EditorChainOutcome"
		>
			{outcome.itemId === undefined ? (
				description
			) : (
				<ItemReference
					description={description}
					itemId={outcome.itemId}
					sectionId="chain"
				/>
			)}
		</div>
	);
};

const ItemReference = ({
	description,
	itemId,
	sectionId = "identity",
}: {
	readonly description?: ReactNode;
	readonly itemId: string;
	readonly sectionId?: "identity" | "chain";
}) => {
	const project = useEditorProject();
	const item = project.config.items[itemId];
	if (item === undefined)
		return (
			<span className="flex min-w-0 flex-col gap-1 text-muted">
				<span>{itemId}</span>
				{description}
			</span>
		);
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
				resourceIds={item.artwork.default}
				size="input"
			/>
			<span className="flex min-w-0 flex-col gap-1">
				<span className="break-words">{item.title}</span>
				{description}
			</span>
		</ButtonLink>
	);
};

const ChainBranchReference = ({ node }: { readonly node: readItemChainsFn.Node }) => {
	const translator = useTranslator();
	return (
		<ItemReference
			description={
				<>
					{node.quantity === undefined && node.stop === undefined ? null : (
						<span className="flex flex-wrap items-center gap-2">
							{node.quantity === undefined ? null : (
								<span className="text-sm">{quantityFn(node.quantity)}</span>
							)}
							{node.stop === undefined ? null : (
								<span className="text-xs text-muted">
									{translator.textFn(stopLabels[node.stop])}
								</span>
							)}
						</span>
					)}
					{node.output === undefined ? null : (
						<span className="text-xs text-muted">
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
										node.output.type === "weight" ? "Weighted" : "Guaranteed",
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
						</span>
					)}
				</>
			}
			itemId={node.itemId}
		/>
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
					{translator.textFn("Source")}: <strong>{step.sourceAction}</strong> ·{" "}
					{translator.textFn("Target")}: <strong>{step.targetEffect}</strong>
				</p>
			)}
			{step.kind !== "pulse" ? null : (
				<div className="mt-1">
					<Mx label="Chain pulse explanation" />
				</div>
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
						<ChainBranchReference node={node} />
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
