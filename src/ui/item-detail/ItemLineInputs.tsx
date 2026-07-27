import { match } from "ts-pattern";

import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import { ItemReferenceButton } from "~/ui/item-detail/ItemReferenceButton";

const ItemLineInputTitle = ({
	detail,
	disabled,
	label,
}: {
	readonly detail?: ItemDetailLines.DetailReference;
	readonly disabled: boolean;
	readonly label: string;
}) =>
	detail === undefined ? (
		<p className="truncate font-medium text-foreground">{label}</p>
	) : (
		<ItemReferenceButton
			compositeUrl={detail.compositeUrl}
			dataUi="TileLineInputDetailLink"
			definitionItemId={detail.itemId}
			disabled={disabled}
			label={label}
			runtimeItemId={detail.detailItemId}
			sourceUrl={detail.sourceUrl}
		/>
	);

const ItemLineInputRow = ({
	disabled,
	input,
}: {
	readonly disabled: boolean;
	readonly input: ItemDetailLines.Input;
}) =>
	match(input)
		.with(
			{
				kind: "materials",
			},
			(materials) => {
				const label =
					materials.selector.kind === "tag"
						? materials.selector.label
								.replaceAll(":", " ")
								.replaceAll("-", " ")
								.replaceAll("_", " ")
								.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
						: materials.selector.label;
				return (
					<div
						className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 py-2 text-sm"
						data-ui="TileLineInput"
						data-input-kind="materials"
					>
						<div className="min-w-0">
							<ItemLineInputTitle
								detail={materials.detail}
								disabled={disabled}
								label={label}
							/>
							<p className="mt-0.5 text-xs text-muted">
								{materials.mode === "consume" ? "Consumed" : "Reserved"}
								{materials.charges === undefined
									? ""
									: ` · ${materials.charges.cost} charge${materials.charges.cost === 1 ? "" : "s"} from ${materials.charges.from === "self" ? "owner" : "target"}`}
							</p>
						</div>
						<div className="flex flex-col items-end text-right">
							<p className="font-medium text-foreground">
								{materials.storedQuantity} /{" "}
								{materials.required.min === materials.required.max
									? materials.required.min
									: `${materials.required.min}–${materials.required.max}`}{" "}
								stored
							</p>
							<p className="mt-0.5 text-xs text-muted">
								{materials.ready
									? `${materials.availableCapacity} buffer space`
									: `${materials.missingQuantity} still needed`}
							</p>
						</div>
					</div>
				);
			},
		)
		.with(
			{
				kind: "deposit",
			},
			(deposit) => {
				const label =
					deposit.selector.kind === "tag"
						? deposit.selector.label
								.replaceAll(":", " ")
								.replaceAll("-", " ")
								.replaceAll("_", " ")
								.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
						: deposit.selector.label;
				return (
					<div
						className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 py-2 text-sm"
						data-ui="TileLineInput"
						data-input-kind="deposit"
					>
						<div className="min-w-0">
							<ItemLineInputTitle
								detail={deposit.detail}
								disabled={disabled}
								label={label}
							/>
							<p className="mt-0.5 text-xs text-muted">
								Board · {deposit.distance}
								{deposit.charges === undefined
									? ""
									: ` · ${deposit.charges.cost} charge${deposit.charges.cost === 1 ? "" : "s"} from ${deposit.charges.from === "self" ? "owner" : "target"}`}
							</p>
						</div>
						<div className="text-right">
							<p className="font-medium text-foreground">
								{deposit.requiredCharges} / {deposit.availableCharges} available
							</p>
							{deposit.targetTitles.length === 0 ? null : (
								<p className="mt-0.5 max-w-56 truncate text-xs text-muted">
									{deposit.targetTitles.join(", ")}
								</p>
							)}
						</div>
					</div>
				);
			},
		)
		.with(
			{
				kind: "simple",
			},
			(simple) => (
				<div
					className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 py-2 text-sm"
					data-ui="TileLineInput"
					data-input-kind="simple"
				>
					<p className="font-medium text-foreground">Owner charge</p>
					<p className="text-right text-sm text-muted">
						{simple.charges.cost} charge{simple.charges.cost === 1 ? "" : "s"} from{" "}
						{simple.charges.from === "self" ? "owner" : "target"}
					</p>
				</div>
			),
		)
		.exhaustive();

/** Renders the full authored input side of one visible product line. */
export const ItemLineInputs = ({
	disabled,
	input,
}: {
	readonly disabled: boolean;
	readonly input: readonly ItemDetailLines.Input[];
}) => (
	<section className="min-w-0">
		<h4 className="border-b border-line pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
			Inputs
		</h4>
		{input.length === 0 ? (
			<p className="py-3 text-sm text-muted">No material input required.</p>
		) : (
			<div className="divide-y divide-line/60">
				{input.map((entry, index) => (
					<ItemLineInputRow
						key={`${entry.kind}:${index}`}
						disabled={disabled}
						input={entry}
					/>
				))}
			</div>
		)}
	</section>
);
