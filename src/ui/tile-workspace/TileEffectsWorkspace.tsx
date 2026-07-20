import { match } from "ts-pattern";

import type { useTileEffects } from "~/bridge/tile/useTileEffects";

const ruleLabel = (effect: useTileEffects.EffectCondition) =>
	match(effect)
		.with(
			{
				ruleType: "show",
			},
			() => "Show line",
		)
		.with(
			{
				ruleType: "hide",
			},
			() => "Hide line",
		)
		.with(
			{
				ruleType: "enable",
			},
			() => "Enable line",
		)
		.with(
			{
				ruleType: "disable",
			},
			() => "Disable line",
		)
		.with(
			{
				ruleType: "runtime:multiplier",
			},
			() => `Runtime ×${effect.multiplier ?? 1}`,
		)
		.exhaustive();

const selectorLabel = (selector: useTileEffects.EffectCondition["selector"]) =>
	match(selector)
		.with(
			{
				type: "item",
			},
			({ itemId }) => itemId,
		)
		.with(
			{
				type: "tag",
			},
			({ tag }) => `tag:${tag}`,
		)
		.exhaustive();

const queryLabel = (effect: useTileEffects.EffectCondition) => {
	const scope = match(effect.queryScope)
		.with("any", () => "Local")
		.with("board", () => "Board")
		.with("inventory", () => "Inventory")
		.with("toolbar", () => "Toolbar")
		.with("universe", () => "Universe")
		.exhaustive();
	if (effect.queryScope !== "board") return scope;
	const distance = effect.queryDistance;
	if (distance === undefined) return scope;
	return `${scope} · ${distance}`;
};

const requirementLabel = (effect: useTileEffects.EffectCondition) =>
	match(effect)
		.with(
			{
				conditionType: "exists",
			},
			() => "Must exist",
		)
		.with(
			{
				conditionType: "count",
			},
			() => `Needs exactly ${effect.requiredCount ?? 0}`,
		)
		.with(
			{
				conditionType: "range",
			},
			() => `Needs ${effect.minimumCount ?? 0}–${effect.maximumCount ?? 0}`,
		)
		.exhaustive();

const statusClasses = {
	active: "border-success/35 bg-success/12 text-foreground",
	inactive: "border-line bg-surface text-muted",
} as const;

const EffectPills = ({ effect }: { readonly effect: useTileEffects.EffectCondition }) => (
	<div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
		<span className="rounded-full border border-line px-2.5 py-1 text-muted">
			{queryLabel(effect)}
		</span>
		<span className="rounded-full border border-line px-2.5 py-1 text-muted">
			{requirementLabel(effect)}
		</span>
		<span className="rounded-full border border-line px-2.5 py-1 text-muted">
			{selectorLabel(effect.selector)}
		</span>
	</div>
);

const MatchedItems = ({ effect }: { readonly effect: useTileEffects.EffectCondition }) => {
	if (effect.matchedItems.length === 0) {
		return (
			<p className="mt-3 text-sm text-muted">
				No matching live items satisfy this condition.
			</p>
		);
	}
	return (
		<div
			className="mt-3 flex flex-wrap gap-2"
			data-ui="TileEffectsMatchedItems"
		>
			{effect.matchedItems.map((item) => (
				<span
					key={item.itemId}
					className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted"
				>
					{item.title}
					{item.quantity === 1 ? "" : ` ×${item.quantity}`}
				</span>
			))}
			<span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted">
				Total {effect.matchedQuantity}
			</span>
		</div>
	);
};

const EffectCard = ({
	effect,
	kind,
}: {
	readonly effect: useTileEffects.EffectCondition;
	readonly kind: "incoming" | "outgoing";
}) => (
	<article
		className={`rounded-2xl border p-4 ${effect.active ? statusClasses.active : statusClasses.inactive}`}
		data-ui="TileEffectsCard"
		data-direction={kind}
		data-active={effect.active ? "true" : "false"}
	>
		<div className="flex flex-wrap items-start justify-between gap-3">
			<div className="min-w-0">
				<p className="text-sm font-semibold uppercase tracking-[0.08em] text-muted">
					{ruleLabel(effect)}
				</p>
				<h3 className="mt-1 text-base font-semibold leading-snug text-foreground">
					{kind === "incoming"
						? `${effect.lineTitle} reacts to ${selectorLabel(effect.selector)}`
						: `${effect.ownerTitle} · ${effect.lineTitle}`}
				</h3>
			</div>
			<span
				className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${effect.active ? "border-success/35 bg-success/15 text-foreground" : "border-line bg-surface text-muted"}`}
			>
				{effect.active ? "Active" : "Inactive"}
			</span>
		</div>
		<p className="mt-3 text-sm leading-relaxed text-muted">
			{kind === "incoming"
				? "This condition currently influences one of this tile's own lines."
				: "This tile currently participates in another tile's line condition."}
		</p>
		<EffectPills effect={effect} />
		<MatchedItems effect={effect} />
	</article>
);

const EffectSection = ({
	description,
	effects,
	empty,
	kind,
	title,
}: {
	readonly description: string;
	readonly effects: readonly useTileEffects.EffectCondition[];
	readonly empty: string;
	readonly kind: "incoming" | "outgoing";
	readonly title: string;
}) => (
	<section className="space-y-4">
		<div>
			<h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-muted">
				{title}
			</h3>
			<p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{description}</p>
		</div>
		{effects.length === 0 ? (
			<div className="rounded-2xl border border-dashed border-line p-6 text-sm text-muted">
				{empty}
			</div>
		) : (
			<div
				className="space-y-3"
				data-ui="TileEffectsSection"
				data-direction={kind}
			>
				{effects.map((effect) => (
					<EffectCard
						key={effect.relationId}
						effect={effect}
						kind={kind}
					/>
				))}
			</div>
		)}
	</section>
);

/** Renders the live effect conditions flowing into and out of one exact tile. */
export const TileEffectsWorkspace = ({
	effects,
}: {
	readonly effects: Extract<
		useTileEffects.Projection,
		{
			readonly kind: "available";
		}
	>;
}) => (
	<div
		className="min-h-0 flex-1 overflow-y-auto pr-1"
		data-ui="TileEffectsWorkspace"
	>
		<div className="space-y-8 pb-1">
			<EffectSection
				title="Incoming"
				kind="incoming"
				description="Conditions currently evaluated against this tile's own lines."
				effects={effects.incoming}
				empty="No live incoming effect conditions are attached to this tile."
			/>
			<EffectSection
				title="Outgoing"
				kind="outgoing"
				description="Live conditions on other tiles that currently include this tile."
				effects={effects.outgoing}
				empty="This tile is not currently participating in any other live effect conditions."
			/>
		</div>
	</div>
);
