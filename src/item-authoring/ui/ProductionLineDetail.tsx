import { ArrowUpRight, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { DropSchema } from "~/production-output/schema/DropSchema";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import type { OutputProjection } from "~/production-output/type/OutputProjection";
import { Outputs } from "~/production-output/ui/Outputs";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { LineEditLink } from "~/production-authoring/ui/LineEditLink";
import { DetailReference } from "~/item-authoring/ui/DetailReference";
import { ProductionLineInputs } from "~/item-authoring/ui/ProductionLineInputs";

type ItemRegistry = Record<string, ItemSchema.Type>;

const projectDrop = (drop: DropSchema.Type, items: ItemRegistry): OutputProjection.Item => ({
	itemId: drop.itemId,
	quantity: drop.quantity,
	title: items[drop.itemId]?.title ?? drop.itemId,
	activeRuleHints: [],
});

const projectOutput = (
	output: OutputSchema.Type | undefined,
	items: ItemRegistry,
): readonly OutputProjection.Set<OutputProjection.Item>[] =>
	output?.set.map((set) => ({
		roll: set.roll.map((roll): OutputProjection.Roll<OutputProjection.Item> => {
			if (roll.type === "weight")
				return {
					kind: "weight",
					option: roll.drop.map((option) => ({
						item: option.drop.map((drop) => projectDrop(drop, items)),
						weight: option.weight,
					})),
					selections: roll.quantity,
				};
			return roll.type === "guaranteed"
				? {
						item: roll.drop.map((drop) => projectDrop(drop, items)),
						kind: "guaranteed",
					}
				: {
						chance: roll.chance,
						item: roll.drop.map((drop) => projectDrop(drop, items)),
						kind: "chance",
					};
		}),
		weight: set.weight,
	})) ?? [];

const renderOutputItem = (
	item: OutputProjection.Item,
	items: ItemRegistry,
	projectId: string,
): ReactNode => {
	const definition = items[item.itemId];
	return definition === undefined ? (
		<span className="truncate font-medium text-foreground">{item.title}</span>
	) : (
		<DetailReference
			item={definition}
			projectId={projectId}
		/>
	);
};

const ProductionLineOutputs = ({
	items,
	output,
	projectId,
}: {
	readonly items: ItemRegistry;
	readonly output: OutputSchema.Type | undefined;
	readonly projectId: string;
}) => (
	<Outputs
		output={projectOutput(output, items)}
		renderItem={(item) => renderOutputItem(item, items, projectId)}
	/>
);

const LineRuntime = ({ runtimeMs }: { readonly runtimeMs: number }) => (
	<div className="grid min-w-32 grid-rows-[1rem_1.5rem_1rem] text-right">
		<p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Runtime</p>
		<div className="col-start-1 row-span-2 row-start-2 grid grid-rows-[1.5rem_1rem]">
			<p className="self-center font-semibold tabular-nums text-foreground">
				{formatDurationFn(runtimeMs)}
			</p>
			<p className="self-end text-xs tabular-nums text-muted">Per cycle</p>
		</div>
	</div>
);

/** Composes authored line identity, runtime, inputs, and outputs without runtime state. */
export const ProductionLineDetail = ({
	itemUid,
	line,
}: {
	readonly itemUid: string;
	readonly line: LineSchema.Type;
}) => {
	const project = useEditorProject();
	const items = project.config?.items ?? {};
	return (
		<article
			className="ak-list-row overflow-hidden rounded-xl border-b border-l-2 border-line border-l-line/55 px-3 py-5 pl-4 first:pt-3 last:border-b-0 last:pb-5"
			data-ui="EditorProductionLineDetail"
			data-line-id={line.id}
		>
			<div className="relative z-[1] flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="text-lg font-semibold leading-tight text-foreground">
							<LineEditLink
								dataUi="EditorProductionLineDetailEditLink"
								itemUid={itemUid}
								lineId={line.id}
							>
								{line.title}
								<ArrowUpRight className="size-4 shrink-0 text-muted transition-colors group-hover:text-accent" />
							</LineEditLink>
						</h3>
						{!line.enable ? (
							<span className="rounded-full border border-danger/35 bg-danger/10 px-2.5 py-1 text-xs font-semibold text-foreground">
								Disabled
							</span>
						) : null}
						{line.default ? (
							<span className="rounded-full border border-accent/35 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-foreground">
								Default
							</span>
						) : null}
					</div>
					<p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
						{line.description}
					</p>
				</div>
				<LineRuntime runtimeMs={line.runtimeMs} />
			</div>
			<div className="relative z-[1] mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] gap-x-4">
				<ProductionLineInputs
					input={line.input}
					items={items}
					projectId={project.projectId}
				/>
				<div
					className="grid place-items-center text-muted"
					data-ui="EditorProductionLineFlowChevron"
				>
					<ChevronRight className="size-5" />
				</div>
				<ProductionLineOutputs
					items={items}
					output={line.output}
					projectId={project.projectId}
				/>
			</div>
		</article>
	);
};
