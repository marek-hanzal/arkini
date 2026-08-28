import type {
	EditorDrop,
	EditorDropRule,
	EditorLineRule,
	EditorOutput,
	EditorQuery,
	EditorQuantity,
	EditorRoll,
	EditorWhen,
} from "~/bridge/item/editor/EditorItemModel";
import { DetailFact, DetailFacts, EmptyDetail } from "~/ui/item/editor/EditorItemDetailDefinition";
import { EditorSelectorDetail } from "~/ui/item/editor/EditorSelectorDetail";

const formatQuantity = (quantity: EditorQuantity) =>
	quantity.min === quantity.max ? String(quantity.min) : `${quantity.min}–${quantity.max}`;

const QueryDetail = ({ query }: { readonly query: EditorQuery }) => (
	<span>
		<EditorSelectorDetail selector={query.selector} /> in {query.scope}
		{"distance" in query ? ` · ${query.distance} distance` : ""}
	</span>
);

const WhenDetail = ({ when }: { readonly when: EditorWhen }) => (
	<li>
		<span className="font-medium capitalize">{when.type}</span>
		{when.type === "count" ? ` ${when.count}` : ""}
		{when.type === "range" ? ` ${when.min}–${when.max}` : ""}:{" "}
		<QueryDetail query={when.query} />
	</li>
);

const RuleDetail = ({ rule }: { readonly rule: EditorDropRule | EditorLineRule }) => (
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
	readonly rules: ReadonlyArray<EditorDropRule | EditorLineRule>;
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

const DropDetail = ({ drop }: { readonly drop: EditorDrop }) => (
	<li className="py-3 first:pt-0 last:pb-0">
		<DetailFacts>
			<DetailFact
				label="Item"
				mono
				value={drop.itemId}
			/>
			<DetailFact
				label="Quantity"
				value={formatQuantity(drop.quantity)}
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

const RollDetail = ({ roll }: { readonly roll: EditorRoll }) => {
	if (roll.type === "weight")
		return (
			<li className="grid gap-3 py-3 first:pt-0 last:pb-0">
				<p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
					{roll.type} · {formatQuantity(roll.quantity)} picks
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
										key={`${drop.itemId}-${dropIndex}`}
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
						key={`${drop.itemId}-${index}`}
					/>
				))}
			</ul>
		</li>
	);
};

/** Presents authored output sets, rolls, drops, and conditional rules. */
export const OutputDetail = ({ output }: { readonly output?: EditorOutput }) =>
	output === undefined ? (
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
								key={`${roll.type}-${rollIndex}`}
								roll={roll}
							/>
						))}
					</ul>
				</section>
			))}
		</div>
	);
