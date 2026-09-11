import { AnimatePresence, motion } from "motion/react";
import { Pencil } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { NeighborhoodArtworkRuleSchema } from "~/item-definition/schema/NeighborhoodArtworkRuleSchema";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { Button } from "~/ui/ui/Button";

const positions = [
	"nw",
	"n",
	"ne",
	"w",
	"center",
	"e",
	"sw",
	"s",
	"se",
] as const;
const positionLabels = {
	nw: "Top left",
	n: "Top",
	ne: "Top right",
	w: "Left",
	e: "Right",
	sw: "Bottom left",
	s: "Bottom",
	se: "Bottom right",
} as const;

/** The form grid shares authored tile scale without running a gameplay board. */
export const NeighborhoodArtworkBoard = ({
	rule,
	scale,
	items,
	onCycleFn,
	onChooseItemFn,
}: {
	readonly rule: NeighborhoodArtworkRuleSchema.Type;
	readonly scale: number;
	readonly items: Readonly<Record<string, Pick<ItemSchema.Type, "title" | "asset">>>;
	readonly onCycleFn?: (position: keyof NeighborhoodArtworkRuleSchema.Type["neighbors"]) => void;
	readonly onChooseItemFn?: (
		position: keyof NeighborhoodArtworkRuleSchema.Type["neighbors"],
	) => void;
}) => (
	<div
		className="grid w-72 max-w-full grid-cols-3 overflow-hidden rounded-xl border border-line-strong"
		data-ui="NeighborhoodArtworkBoard"
	>
		{positions.map((position) => {
			const condition = position === "center" ? undefined : rule.neighbors[position];
			const item = condition?.type === "item" ? items[condition.itemId] : undefined;
			const resourceIds =
				position === "center"
					? ([
							rule.sourceId,
						] as [
							string,
						])
					: item?.asset.default;
			const label =
				condition === undefined
					? "Result"
					: condition.type === "item"
						? (item?.title ?? condition.itemId)
						: (
								{
									ignore: "Ignore",
									empty: "Empty",
									filled: "Filled",
								} as const
							)[condition.type];
			const visualKey = JSON.stringify([
				condition?.type,
				condition?.type === "item" ? condition.itemId : undefined,
				resourceIds,
				item?.asset.scale ?? scale,
			]);
			const content = (
				<CellContents
					visualKey={visualKey}
					imageCount={resourceIds?.filter((id) => id !== "").length ?? 0}
				>
					{resourceIds === undefined ? (
						<span className="text-xs font-semibold text-muted">{label}</span>
					) : (
						<div className="grid size-full place-items-center">
							<div
								style={{
									width: `${(item?.asset.scale ?? scale) * 100}%`,
									height: `${(item?.asset.scale ?? scale) * 100}%`,
								}}
							>
								<EditorItemThumbnail
									className="size-full rounded-none border-0 bg-transparent"
									resourceIds={resourceIds}
								/>
							</div>
						</div>
					)}
				</CellContents>
			);
			return (
				<div
					key={position}
					className="relative aspect-square border border-line bg-canvas data-[ui-center=true]:bg-accent/10"
					{...readDataUiFn({
						dataUi: "NeighborhoodArtworkCell",
						state: {
							center: position === "center",
							position,
							condition: condition?.type,
						},
					})}
				>
					{onCycleFn === undefined || position === "center" ? (
						<div
							className="size-full"
							title={label}
						>
							{content}
						</div>
					) : (
						<button
							type="button"
							className="block size-full cursor-pointer transition-colors hover:bg-surface-raised"
							title={`${positionLabels[position]}: ${label}. Click to cycle.`}
							onClick={() => onCycleFn(position)}
						>
							{content}
						</button>
					)}
					{condition?.type === "item" &&
					position !== "center" &&
					onChooseItemFn !== undefined ? (
						<Button
							className="absolute right-0.5 bottom-0.5 min-h-0 rounded p-1 shadow-none"
							title={`Change ${positionLabels[position].toLowerCase()} item`}
							onClick={() => onChooseItemFn(position)}
						>
							<Pencil className="size-3" />
						</Button>
					) : null}
				</div>
			);
		})}
	</div>
);

/** Retains outgoing resources until the newest composition is loaded, then crossfades both layers. */
const CellContents = ({
	children,
	visualKey,
	imageCount,
}: {
	readonly children: ReactNode;
	readonly visualKey: string;
	readonly imageCount: number;
}) => {
	const [shown, setShownFn] = useState({
		key: visualKey,
		children,
	});
	const pendingRef = useRef<HTMLSpanElement>(null);
	const pending = shown.key !== visualKey;
	const publishReadyFn = () => {
		if (!pending) return;
		const images = Array.from(pendingRef.current?.querySelectorAll("img") ?? []);
		if (
			images.length < imageCount ||
			images.some((image) => !image.complete || image.naturalWidth === 0)
		)
			return;
		setShownFn({
			key: visualKey,
			children,
		});
	};
	useLayoutEffect(publishReadyFn);
	return (
		<span className="relative block size-full">
			<AnimatePresence initial={false}>
				<motion.span
					key={shown.key}
					className="pointer-events-none absolute inset-0 grid place-items-center"
					initial={{
						opacity: 0,
					}}
					animate={{
						opacity: 1,
					}}
					exit={{
						opacity: 0,
					}}
					transition={{
						duration: 0.2,
					}}
				>
					{pending ? shown.children : children}
				</motion.span>
				{pending ? (
					<motion.span
						key={visualKey}
						ref={pendingRef}
						className="pointer-events-none absolute inset-0 grid place-items-center"
						initial={{
							opacity: 0,
						}}
						animate={{
							opacity: 0,
						}}
						exit={{
							opacity: 0,
						}}
						transition={{
							duration: 0.2,
						}}
						onLoadCapture={publishReadyFn}
					>
						{children}
					</motion.span>
				) : null}
			</AnimatePresence>
		</span>
	);
};
