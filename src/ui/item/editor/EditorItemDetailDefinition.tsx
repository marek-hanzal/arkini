import type { ReactNode } from "react";

import type {
	EditorDrop,
	EditorDropRule,
	EditorInput,
	EditorLine,
	EditorLineRule,
	EditorOutput,
	EditorQuery,
	EditorQuantity,
	EditorRoll,
	EditorSelector,
	EditorWhen,
} from "~/bridge/item/editor/EditorItemModel";

export const DetailSection = ({
	children,
	description,
	title,
}: {
	readonly children: ReactNode;
	readonly description?: string;
	readonly title: string;
}) => (
	<section className="grid gap-4 border-b border-line pb-6 last:border-0 last:pb-0">
		<header>
			<h2 className="text-lg font-semibold">{title}</h2>
			{description === undefined ? null : (
				<p className="mt-1 text-sm text-muted">{description}</p>
			)}
		</header>
		{children}
	</section>
);

export const DetailFacts = ({ children }: { readonly children: ReactNode }) => (
	<dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>
);

export const DetailFact = ({
	label,
	mono = false,
	value,
}: {
	readonly label: string;
	readonly mono?: boolean;
	readonly value: ReactNode;
}) => (
	<div className="min-w-0">
		<dt className="text-xs uppercase tracking-wider text-subtle">{label}</dt>
		<dd className={`mt-1 break-words text-sm text-foreground ${mono ? "font-mono" : ""}`}>
			{value}
		</dd>
	</div>
);

export const EmptyDetail = ({ children }: { readonly children: ReactNode }) => (
	<p className="text-sm text-muted">{children}</p>
);

const formatQuantity = (quantity: EditorQuantity) =>
	quantity.type === "value" ? String(quantity.value) : `${quantity.min}–${quantity.max}`;

const formatSelector = (selector: EditorSelector) =>
	selector.type === "item" ? `Item ${selector.itemId}` : `Tag ${selector.tag}`;

const QueryDetail = ({ query }: { readonly query: EditorQuery }) => (
	<span>
		{formatSelector(query.selector)} in {query.scope}
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
	<li className="border-t border-line py-3 first:border-0 first:pt-0 last:pb-0">
		<p className="font-medium capitalize">
			{rule.type}
			{"multiplier" in rule ? ` × ${rule.multiplier}` : ""}
		</p>
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
	<li className="border-t border-line py-3 first:border-0 first:pt-0 last:pb-0">
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
	if (roll.type === "weight") {
		return (
			<li className="border-t border-line py-3 first:border-0 first:pt-0 last:pb-0">
				<p className="font-medium capitalize">
					{roll.type} · {formatQuantity(roll.quantity)} picks
				</p>
				<ul className="mt-2 border-l border-line pl-4">
					{roll.drop.map((candidate, index) => (
						<li
							className="border-t border-line py-3 first:border-0 first:pt-0"
							key={`${candidate.weight}-${index}`}
						>
							<p className="text-sm text-muted">Weight {candidate.weight}</p>
							<ul className="mt-2 border-l border-line pl-4">
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
	}
	return (
		<li className="border-t border-line py-3 first:border-0 first:pt-0 last:pb-0">
			<p className="font-medium capitalize">
				{roll.type}
				{roll.type === "chance" ? ` · ${Math.round(roll.chance * 100)}%` : ""}
			</p>
			<ul className="mt-2 border-l border-line pl-4">
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

export const OutputDetail = ({ output }: { readonly output?: EditorOutput }) =>
	output === undefined ? (
		<EmptyDetail>No output.</EmptyDetail>
	) : (
		<div className="grid gap-3">
			{output.set.map((set, index) => (
				<section
					className="border-t border-line pt-3 first:border-0 first:pt-0"
					key={`set-${index}`}
				>
					<p className="text-sm font-medium">
						Set {index + 1} · weight {set.weight ?? 1}
					</p>
					<ul className="mt-2 border-l border-line pl-4">
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

const InputDetail = ({ input }: { readonly input: EditorInput }) => (
	<li className="border-t border-line py-3 first:border-0 first:pt-0 last:pb-0">
		<p className="font-medium capitalize">{input.type}</p>
		<div className="mt-2">
			<DetailFacts>
				{input.type === "materials" ? (
					<>
						<DetailFact
							label="Selector"
							value={formatSelector(input.selector)}
						/>
						<DetailFact
							label="Mode"
							value={input.mode}
						/>
						<DetailFact
							label="Quantity"
							value={formatQuantity(input.quantity)}
						/>
						<DetailFact
							label="Extra capacity"
							value={input.capacity}
						/>
					</>
				) : null}
				{input.type === "deposit" ? (
					<DetailFact
						label="Query"
						value={<QueryDetail query={input.query} />}
					/>
				) : null}
				{input.charges === undefined ? null : (
					<DetailFact
						label="Charge cost"
						value={`${input.charges.cost} from ${input.charges.from}`}
					/>
				)}
			</DetailFacts>
		</div>
	</li>
);

export const LineDetail = ({ line }: { readonly line: EditorLine }) => (
	<article className="grid gap-4 border-b border-line pb-6 last:border-0 last:pb-0">
		<header>
			<div className="flex flex-wrap items-baseline gap-2">
				<h3 className="text-base font-semibold">{line.title}</h3>
				<span className="font-mono text-xs text-muted">{line.id}</span>
			</div>
			<p className="mt-1 text-sm text-muted">{line.description || "No description."}</p>
		</header>
		<DetailFacts>
			<DetailFact
				label="Default"
				value={line.default ? "Yes" : "No"}
			/>
			<DetailFact
				label="Visible"
				value={line.show ? "Yes" : "No"}
			/>
			<DetailFact
				label="Enabled"
				value={line.enable ? "Yes" : "No"}
			/>
			<DetailFact
				label="Runtime"
				value={`${line.runtimeMs} ms`}
			/>
		</DetailFacts>
		<section>
			<h4 className="text-sm font-semibold">Inputs</h4>
			<ul className="mt-2 border-l border-line pl-4">
				{line.input.map((input, index) => (
					<InputDetail
						input={input}
						key={`${input.type}-${index}`}
					/>
				))}
			</ul>
		</section>
		<section>
			<h4 className="text-sm font-semibold">Output</h4>
			<div className="mt-2 border-l border-line pl-4">
				<OutputDetail output={line.output} />
			</div>
		</section>
		<section>
			<h4 className="text-sm font-semibold">Rules</h4>
			<div className="mt-2 border-l border-line pl-4">
				<RulesDetail rules={line.rules} />
			</div>
		</section>
	</article>
);

export { formatSelector };
