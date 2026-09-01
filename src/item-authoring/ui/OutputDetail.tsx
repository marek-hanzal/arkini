import type { RuleSchema as LineRuleSchema } from "~/production-line/schema/RuleSchema";
import type { DropSchema } from "~/production-output/schema/DropSchema";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import type { DropRuleSchema } from "~/production-output/schema/DropRuleSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { QuantitySchema } from "~/item-definition/schema/QuantitySchema";
import type { QuerySchema } from "~/item-query/schema/QuerySchema";
import type { RollSchema } from "~/production-output/schema/RollSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { DetailFact, DetailFacts, EmptyDetail } from "~/item-authoring/ui/DetailDefinition";
import { DetailReference } from "~/item-authoring/ui/DetailReference";
import { SelectorDetail } from "~/item-authoring/ui/SelectorDetail";

type ItemRegistry = Record<string, ItemSchema.Type>;

const formatQuantityFn = (quantity: QuantitySchema.Type) =>
	quantity.min === quantity.max ? String(quantity.min) : `${quantity.min}–${quantity.max}`;

const QueryDetail = ({ query }: { readonly query: QuerySchema.Type }) => (
	<span>
		<SelectorDetail selector={query.selector} /> in {query.scope}
		{"distance" in query ? ` · ${query.distance} distance` : ""}
	</span>
);

const WhenDetail = ({ when }: { readonly when: WhenSchema.Type }) => (
	<li>
		<span className="font-medium capitalize">{when.type}</span>
		{when.type === "count" ? ` ${when.count}` : ""}
		{when.type === "range" ? ` ${when.min}–${when.max}` : ""}:{" "}
		<QueryDetail query={when.query} />
	</li>
);

const RuleDetail = ({ rule }: { readonly rule: DropRuleSchema.Type | LineRuleSchema.Type }) => (
	<li className="py-3 first:pt-0 last:pb-0">
		<p className="font-medium capitalize">
			{rule.type}
			{"multiplier" in rule ? ` × ${rule.multiplier}` : ""}
			{"adjustMs" in rule
				? ` ${rule.adjustMs >= 0 ? "+" : ""}${rule.adjustMs / 1_000} s`
				: ""}
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

const RulesDetail = ({
	rules,
}: {
	readonly rules: ReadonlyArray<DropRuleSchema.Type | LineRuleSchema.Type>;
}) =>
	rules.length === 0 ? (
		<EmptyDetail>No rules.</EmptyDetail>
	) : (
		<ul>
			{rules.map((rule, index) => (
				<RuleDetail
					key={`${rule.type}-${index}`}
					rule={rule}
				/>
			))}
		</ul>
	);

const DropDetail = ({
	drop,
	items,
	projectId,
}: {
	readonly drop: DropSchema.Type;
	readonly items: ItemRegistry;
	readonly projectId: string;
}) => {
	const item = items[drop.itemId];
	return (
		<li className="py-3 first:pt-0 last:pb-0">
			<DetailFacts>
				<DetailFact
					label="Item"
					mono={item === undefined}
					value={
						item === undefined ? (
							drop.itemId
						) : (
							<DetailReference
								item={item}
								projectId={projectId}
							/>
						)
					}
				/>
				<DetailFact
					label="Quantity"
					value={formatQuantityFn(drop.quantity)}
				/>
				<DetailFact
					label="Placement"
					value={drop.placement}
				/>
			</DetailFacts>
			{drop.rules.length === 0 ? null : (
				<div className="mt-3">
					<p className="text-xs uppercase tracking-wider text-subtle">Rules</p>
					<RulesDetail rules={drop.rules} />
				</div>
			)}
		</li>
	);
};

const RollDetail = ({
	items,
	projectId,
	roll,
}: {
	readonly items: ItemRegistry;
	readonly projectId: string;
	readonly roll: RollSchema.Type;
}) => {
	if (roll.type === "weight")
		return (
			<li className="grid gap-3 py-3 first:pt-0 last:pb-0">
				<p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
					{roll.type} · {formatQuantityFn(roll.quantity)} picks
				</p>
				<ul className="grid gap-3">
					{roll.drop.map((candidate, index) => (
						<li
							className="border-l border-line pl-3"
							key={`${candidate.weight}-${index}`}
						>
							<p className="text-sm text-muted">Weight {candidate.weight}</p>
							<ul className="mt-2 divide-y divide-line/60">
								{candidate.drop.map((drop, dropIndex) => (
									<DropDetail
										drop={drop}
										items={items}
										key={`${drop.itemId}-${dropIndex}`}
										projectId={projectId}
									/>
								))}
							</ul>
						</li>
					))}
				</ul>
			</li>
		);
	return (
		<li className="grid gap-2 py-3 first:pt-0 last:pb-0">
			<p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
				{roll.type}
				{roll.type === "chance" ? ` · ${Math.round(roll.chance * 100)}%` : ""}
			</p>
			<ul className="divide-y divide-line/60">
				{roll.drop.map((drop, index) => (
					<DropDetail
						drop={drop}
						items={items}
						key={`${drop.itemId}-${index}`}
						projectId={projectId}
					/>
				))}
			</ul>
		</li>
	);
};

/** Presents authored output sets, rolls, drops, and conditional rules. */
export const OutputDetail = ({ output }: { readonly output?: OutputSchema.Type }) => {
	const project = useEditorProject();
	return output === undefined ? (
		<EmptyDetail>No output.</EmptyDetail>
	) : (
		<div className="divide-y divide-line/60">
			{output.set.map((set, index) => (
				<section
					className="py-2 first:pt-0 last:pb-0"
					key={`set-${index}`}
				>
					<p className="text-sm font-medium">
						Set {index + 1} · weight {set.weight}
					</p>
					<ul className="mt-2 divide-y divide-line/60">
						{set.roll.map((roll, rollIndex) => (
							<RollDetail
								items={project.config.items}
								key={`${roll.type}-${rollIndex}`}
								projectId={project.projectId}
								roll={roll}
							/>
						))}
					</ul>
				</section>
			))}
		</div>
	);
};
