import { match } from "ts-pattern";

import type { useItemDetailLines } from "~/bridge/item-detail/useItemDetailLines";

const formatQuantity = ({ min, max }: useItemDetailLines.QuantityBounds) =>
	min === max ? `${min}` : `${min}–${max}`;

const formatDuration = (milliseconds: number) => {
	if (milliseconds === 0) return "Immediate";
	const seconds = milliseconds / 1_000;
	if (seconds < 60) return Number.isInteger(seconds) ? `${seconds} s` : `${seconds.toFixed(1)} s`;
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.round(seconds % 60);
	return remainingSeconds === 0 ? `${minutes} min` : `${minutes} min ${remainingSeconds} s`;
};

const humanizeTag = (tag: string) =>
	tag
		.replaceAll(":", " ")
		.replaceAll("-", " ")
		.replaceAll("_", " ")
		.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());

const selectorLabel = (selector: useItemDetailLines.Selector) =>
	selector.kind === "tag" ? humanizeTag(selector.label) : selector.label;

const chargeLabel = (charges: useItemDetailLines.ChargeCost) =>
	`${charges.cost} charge${charges.cost === 1 ? "" : "s"} from ${charges.from === "self" ? "owner" : "target"}`;

const readinessLabel = (availability: useItemDetailLines.Availability) =>
	match(availability)
		.with(
			{
				kind: "ready",
			},
			() => ({
				label: "Ready",
				className: "border-success/35 bg-success/12 text-foreground",
			}),
		)
		.with(
			{
				kind: "blocked",
				reason: "disabled",
			},
			() => ({
				label: "Disabled",
				className: "border-danger/35 bg-danger/10 text-foreground",
			}),
		)
		.with(
			{
				kind: "blocked",
				reason: "inputs",
			},
			() => ({
				label: "Missing inputs",
				className: "border-warning/35 bg-warning/10 text-foreground",
			}),
		)
		.with(
			{
				kind: "blocked",
				reason: "queue",
			},
			() => ({
				label: "Queue full",
				className: "border-warning/35 bg-warning/10 text-foreground",
			}),
		)
		.with(
			{
				kind: "blocked",
				reason: "stored",
			},
			() => ({
				label: "Stored",
				className: "border-line bg-surface text-muted",
			}),
		)
		.exhaustive();

const InputRow = ({ input }: { readonly input: useItemDetailLines.Input }) =>
	match(input)
		.with(
			{
				kind: "materials",
			},
			(input) => (
				<div
					className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 py-2 text-sm"
					data-ui="TileLineInput"
					data-input-kind="materials"
				>
					<div className="min-w-0">
						<p className="truncate font-medium text-foreground">
							{selectorLabel(input.selector)}
						</p>
						<p className="mt-0.5 text-xs text-muted">
							{input.mode === "consume" ? "Consumed" : "Reserved"}
							{input.charges === undefined ? "" : ` · ${chargeLabel(input.charges)}`}
						</p>
					</div>
					<div className="text-right">
						<p className="font-medium text-foreground">
							{input.storedQuantity} / {formatQuantity(input.required)} stored
						</p>
						<p className="mt-0.5 text-xs text-muted">
							{input.ready
								? `${input.availableCapacity} buffer space`
								: `${input.missingQuantity} still needed`}
						</p>
					</div>
				</div>
			),
		)
		.with(
			{
				kind: "deposit",
			},
			(input) => (
				<div
					className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 py-2 text-sm"
					data-ui="TileLineInput"
					data-input-kind="deposit"
				>
					<div className="min-w-0">
						<p className="truncate font-medium text-foreground">
							{selectorLabel(input.selector)}
						</p>
						<p className="mt-0.5 text-xs text-muted">
							Board · {input.distance}
							{input.charges === undefined ? "" : ` · ${chargeLabel(input.charges)}`}
						</p>
					</div>
					<div className="text-right">
						<p className="font-medium text-foreground">
							{input.readyTargets} / {input.requiredTargets} available
						</p>
						{input.targetTitles.length === 0 ? null : (
							<p className="mt-0.5 max-w-56 truncate text-xs text-muted">
								{input.targetTitles.join(", ")}
							</p>
						)}
					</div>
				</div>
			),
		)
		.with(
			{
				kind: "simple",
			},
			(input) => (
				<div
					className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 py-2 text-sm"
					data-ui="TileLineInput"
					data-input-kind="simple"
				>
					<p className="font-medium text-foreground">Owner charge</p>
					<p className="text-right text-sm text-muted">{chargeLabel(input.charges)}</p>
				</div>
			),
		)
		.exhaustive();

const OutputItems = ({ items }: { readonly items: readonly useItemDetailLines.OutputItem[] }) => (
	<div className="space-y-1.5">
		{items.map((item) => (
			<div
				key={item.itemId}
				className="flex min-w-0 items-baseline justify-between gap-4 text-sm"
				data-ui="TileLineOutputItem"
			>
				<span className="truncate font-medium text-foreground">{item.title}</span>
				<span className="shrink-0 text-muted">×{formatQuantity(item.quantity)}</span>
			</div>
		))}
	</div>
);

const OutputRoll = ({ roll }: { readonly roll: useItemDetailLines.OutputRoll }) =>
	match(roll)
		.with(
			{
				kind: "guaranteed",
			},
			(roll) => (
				<div
					className="grid gap-2 py-2"
					data-ui="TileLineOutputRoll"
					data-roll-kind="guaranteed"
				>
					<p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
						Guaranteed
					</p>
					<OutputItems items={roll.item} />
				</div>
			),
		)
		.with(
			{
				kind: "chance",
			},
			(roll) => (
				<div
					className="grid gap-2 py-2"
					data-ui="TileLineOutputRoll"
					data-roll-kind="chance"
				>
					<p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
						{Math.round(roll.chance * 100)}% chance
					</p>
					<OutputItems items={roll.item} />
				</div>
			),
		)
		.with(
			{
				kind: "weight",
			},
			(roll) => (
				<div
					className="grid gap-3 py-2"
					data-ui="TileLineOutputRoll"
					data-roll-kind="weight"
				>
					<p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
						{formatQuantity(roll.selections)} weighted selection
						{roll.selections.max === 1 ? "" : "s"}
					</p>
					{roll.option.map((option, index) => (
						<div
							key={`${index}:${option.weight}`}
							className="border-l border-line pl-3"
						>
							<p className="mb-1.5 text-xs text-muted">Weight {option.weight}</p>
							<OutputItems items={option.item} />
						</div>
					))}
				</div>
			),
		)
		.exhaustive();

const LineRow = ({ line }: { readonly line: useItemDetailLines.Line }) => {
	const readiness = readinessLabel(line.availability);
	const runtimeChanged = line.baseRuntimeMs !== line.effectiveRuntimeMs;
	return (
		<article
			className={`ak-list-row rounded-xl border-b border-line px-3 py-5 first:pt-3 last:border-b-0 last:pb-5 ${line.activeJob === undefined ? "" : "ak-list-row-active border-l-2 border-l-accent pl-4"}`}
			data-ui="TileLine"
			data-line-id={line.lineId}
			data-active={line.activeJob === undefined ? "false" : "true"}
		>
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="text-lg font-semibold leading-tight text-foreground">
							{line.title}
						</h3>
						{line.activeJob === undefined ? null : (
							<span className="rounded-full border border-accent/40 bg-accent/12 px-2.5 py-1 text-xs font-semibold text-foreground">
								Active
							</span>
						)}
						<span
							className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${readiness.className}`}
						>
							{readiness.label}
						</span>
					</div>
					<p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
						{line.description}
					</p>
				</div>
				<div className="shrink-0 text-right">
					<p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
						Runtime
					</p>
					<p className="mt-1 font-semibold text-foreground">
						{formatDuration(line.effectiveRuntimeMs)}
					</p>
					{runtimeChanged ? (
						<p className="mt-0.5 text-xs text-muted">
							Base {formatDuration(line.baseRuntimeMs)}
						</p>
					) : null}
				</div>
			</div>

			{line.activeJob === undefined ? null : (
				<div className="mt-4 flex flex-wrap items-baseline justify-between gap-3 border-y border-line/70 py-3 text-sm">
					<span className="font-medium text-foreground">Current work</span>
					<span className="text-muted">
						{formatDuration(line.activeJob.remainingMs)} remaining of{" "}
						{formatDuration(line.activeJob.durationMs)}
					</span>
				</div>
			)}

			<div className="mt-4 grid min-w-0 grid-cols-2 gap-x-8 max-[48rem]:grid-cols-1">
				<section className="min-w-0">
					<h4 className="border-b border-line pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
						Inputs
					</h4>
					{line.input.length === 0 ? (
						<p className="py-3 text-sm text-muted">No material input required.</p>
					) : (
						<div className="divide-y divide-line/60">
							{line.input.map((input, index) => (
								<InputRow
									key={`${input.kind}:${index}`}
									input={input}
								/>
							))}
						</div>
					)}
				</section>

				<section className="min-w-0 max-[48rem]:mt-4">
					<h4 className="border-b border-line pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
						Outputs
					</h4>
					{line.output.length === 0 ? (
						<p className="py-3 text-sm text-muted">
							Consumes inputs without producing an item.
						</p>
					) : (
						<div className="divide-y divide-line/60">
							{line.output.map((set, setIndex) => (
								<div
									key={`${setIndex}:${set.weight}`}
									className="py-1"
								>
									{line.output.length > 1 ? (
										<p className="pt-2 text-xs font-medium text-muted">
											Alternative {setIndex + 1} · weight {set.weight}
										</p>
									) : null}
									<div className="divide-y divide-line/60">
										{set.roll.map((roll, rollIndex) => (
											<OutputRoll
												key={`${roll.kind}:${rollIndex}`}
												roll={roll}
											/>
										))}
									</div>
								</div>
							))}
						</div>
					)}
				</section>
			</div>
		</article>
	);
};

/** Renders the authoritative visible product-line overview inside Item Detail. */
export const ItemLinesTab = ({
	lines,
}: {
	readonly lines: Extract<
		useItemDetailLines.Projection,
		{
			readonly kind: "available";
		}
	>;
}) => (
	<div
		className="flex min-h-0 flex-1 flex-col"
		data-ui="ItemLinesTab"
	>
		<div className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3">
			<div>
				<h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-muted">
					Lines
				</h3>
				<p className="mt-1 text-sm text-muted">
					Current visibility, inputs, outputs and effective runtime.
				</p>
			</div>
			<p className="text-sm font-medium text-muted">
				{lines.line.length} visible line{lines.line.length === 1 ? "" : "s"}
			</p>
		</div>
		<div className="min-h-0 flex-1 overflow-y-auto pr-1">
			{lines.line.length === 0 ? (
				<div className="grid min-h-48 place-items-center border border-dashed border-line text-sm text-muted">
					No product line is currently visible.
				</div>
			) : (
				<div
					className="ak-list grid gap-1"
					data-ui="TileLinesList"
				>
					{lines.line.map((line) => (
						<LineRow
							key={line.lineId}
							line={line}
						/>
					))}
				</div>
			)}
		</div>
	</div>
);
