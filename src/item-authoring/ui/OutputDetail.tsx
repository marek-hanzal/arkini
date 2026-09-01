import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import type { DropRuleSchema } from "~/production-output/schema/DropRuleSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";
import type { OutputProjection } from "~/production-output/type/OutputProjection";
import { projectAuthoredOutputFn } from "~/production-output/fn/projectAuthoredOutputFn";
import { Outputs } from "~/production-output/ui/Outputs";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { DetailReference } from "~/item-authoring/ui/DetailReference";
import { QueryDetail } from "~/item-authoring/ui/QueryDetail";

const WhenDetail = ({ when }: { readonly when: WhenSchema.Type }) => (
	<li className="grid gap-1">
		<p className="font-medium">
			{when.type === "exists"
				? "Exists"
				: when.type === "count"
					? `Exact count · ${when.count}`
					: `Count range · ${when.min}–${when.max}`}
		</p>
		<QueryDetail query={when.query} />
	</li>
);

const RuleDetail = ({ rule }: { readonly rule: DropRuleSchema.Type }) => (
	<li className="py-2 first:pt-0 last:pb-0">
		<p className="font-medium capitalize">
			{rule.type}
			{"multiplier" in rule ? ` × ${rule.multiplier}` : ""}
		</p>
		{rule.hint === undefined ? null : (
			<p className="mt-1 text-sm text-muted">Player hint: {rule.hint}</p>
		)}
		<ul className="mt-1 grid gap-1 pl-4 text-sm text-muted">
			{rule.when.map((when, index) => (
				<WhenDetail
					key={`${when.type}-${index}`}
					when={when}
				/>
			))}
		</ul>
	</li>
);

const AuthoredOutputItemDetail = ({ item }: { readonly item: OutputProjection.AuthoredItem }) =>
	item.placement === "drop" && item.rules.length === 0 ? null : (
		<div className="grid gap-2 text-xs text-muted">
			{item.placement === "drop" ? null : (
				<p>
					<span className="font-medium uppercase tracking-[0.08em]">Placement</span> ·{" "}
					{item.placement}
				</p>
			)}
			{item.rules.length === 0 ? null : (
				<div>
					<p className="font-medium uppercase tracking-[0.08em]">Rules</p>
					<ul className="mt-1 divide-y divide-line/60">
						{item.rules.map((rule, index) => (
							<RuleDetail
								key={`${rule.type}-${index}`}
								rule={rule}
							/>
						))}
					</ul>
				</div>
			)}
		</div>
	);

/** Renders canonical authored output through the shared output presentation. */
export const OutputDetail = ({
	emptyLabel = "No output configured.",
	output,
	title = "Outputs",
}: {
	readonly emptyLabel?: string;
	readonly output?: OutputSchema.Type;
	readonly title?: string;
}) => {
	const project = useEditorProject();
	const items = project.config.items;
	return (
		<Outputs
			emptyLabel={emptyLabel}
			output={projectAuthoredOutputFn(output, items)}
			renderItemDetailFn={(item) => <AuthoredOutputItemDetail item={item} />}
			renderItemFn={(item) => <DetailReference itemId={item.itemId} />}
			title={title}
		/>
	);
};
