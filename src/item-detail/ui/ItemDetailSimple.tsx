import { Info, ListX } from "lucide-react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useEffect, useState } from "react";

import { ItemInfo } from "~/item-detail/ui/ItemInfo";
import { ItemLineInputs } from "~/item-detail/ui/ItemLineInputs";
import { useItemLineWorkController } from "~/item-detail/ui/useItemLineWorkController";
import { useItemLinesStatus } from "~/item-detail/ui/useItemLinesStatus";
import { useItemSimpleDefaultController } from "~/item-detail/ui/useItemSimpleDefaultController";
import type { useItemDetailSceneController } from "~/item-detail/ui/useItemDetailSceneController";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { useTranslator } from "~/translation/ui/useTranslator";
import { LinkButton } from "~/ui/ui/LinkButton";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { Tooltip } from "~/ui/ui/Tooltip";

interface ItemDetailSimpleProps {
	readonly detail: useItemDetailSceneController.Detail;
	readonly disabled: boolean;
	readonly ownerItemId?: IdSchema.Type;
	readonly stale: boolean;
}

const ItemSimplePendingCancel = ({
	clearFn,
	disabled,
}: {
	readonly clearFn: () => void;
	readonly disabled: boolean;
}) => {
	const present = useIsPresent();
	const translator = useTranslator();
	return (
		<motion.div
			className="w-full overflow-hidden"
			initial={{
				height: 0,
				opacity: 0,
				y: -6,
			}}
			animate={{
				height: "auto",
				opacity: 1,
				y: 0,
			}}
			exit={{
				height: 0,
				opacity: 0,
				y: -6,
			}}
			transition={{
				duration: 0.2,
			}}
			inert={!present}
		>
			<Tooltip
				content={translator.textFn(
					"Cancel the planned batches of this recipe. Anything already cooking keeps going.",
				)}
			>
				<LinkButton
					className="flex min-h-12 w-full items-center justify-center gap-2 text-xl text-muted hover:text-foreground disabled:hover:text-muted"
					disabled={disabled || !present}
					onClick={clearFn}
					data-ui="ItemSimplePendingCancel"
				>
					<ListX className="size-6 shrink-0" />
					{translator.textFn("Cancel")}
				</LinkButton>
			</Tooltip>
		</motion.div>
	);
};

const ItemSimpleQueueCancel = ({
	ownerItemId,
	lineUid,
	disabled,
	hasPendingWork,
}: {
	readonly ownerItemId?: IdSchema.Type;
	readonly lineUid: IdSchema.Type;
	readonly disabled: boolean;
	readonly hasPendingWork: boolean;
}) => {
	const key = `${ownerItemId}:${lineUid}`;
	const [visibleKey, setVisibleKeyFn] = useState<string>();
	useEffect(() => {
		if (!hasPendingWork) {
			setVisibleKeyFn(undefined);
			return;
		}
		const timeout = setTimeout(() => setVisibleKeyFn(key), 400);
		return () => clearTimeout(timeout);
	}, [
		key,
		hasPendingWork,
	]);
	const controller = useItemLineWorkController({
		ownerItemId,
		lineUid,
		disabled,
	});
	return (
		<AnimatePresence>
			{hasPendingWork && visibleKey === key ? (
				<ItemSimplePendingCancel
					key={key}
					clearFn={controller.clearFn}
					disabled={controller.clearDisabled}
				/>
			) : null}
		</AnimatePresence>
	);
};

/** Compact item facts and direct control of its effective Default recipe. */
export const ItemDetailSimple = ({
	detail,
	disabled,
	ownerItemId,
	stale,
}: ItemDetailSimpleProps) => {
	const line = detail.defaultLine;
	const controller = useItemSimpleDefaultController({
		ownerItemId,
		lineUid: line?.uid,
		disabled: disabled || stale || line === undefined,
		ready: detail.defaultLinePlayReady,
		autofillCovered: detail.defaultLineAutofillCovered,
	});
	const statuses = useItemLinesStatus(ownerItemId);
	const hasPendingWork = statuses.some(
		(status) => status.lineUid === line?.uid && status.queued > 0,
	);
	const actionDisabled =
		disabled ||
		stale ||
		line === undefined ||
		!detail.defaultLinePlayReady ||
		!controller.displayReady ||
		controller.pending;
	const visualReady = controller.displayReady && !disabled && !stale;
	const hasRequirements = line?.input.some(
		(input) =>
			input.type === "materials" ||
			(input.type === "units" && input.query.distance !== "self"),
	);
	const action =
		line === undefined ? null : (
			<LinkButton
				className="flex min-h-24 w-full min-w-0 items-center justify-center px-6 py-3 text-center text-4xl leading-tight font-semibold disabled:hover:text-muted data-[ui-visual-ready=true]:disabled:text-accent data-[ui-visual-ready=true]:disabled:hover:text-accent"
				disabled={actionDisabled}
				onClick={controller.startFn}
				{...readDataUiFn({
					dataUi: "ItemSimpleDefaultAction",
					state: {
						visualReady,
					},
				})}
			>
				{line.title}
			</LinkButton>
		);
	const cancel =
		line === undefined ? null : (
			<ItemSimpleQueueCancel
				ownerItemId={ownerItemId}
				lineUid={line.uid}
				disabled={disabled}
				hasPendingWork={hasPendingWork}
			/>
		);
	return (
		<div
			className="grid min-h-full items-center"
			data-ui="ItemDetailSimple"
		>
			<ItemInfo
				detail={detail}
				stale={stale}
			>
				{stale || line === undefined ? null : (
					<div
						className="grid gap-4"
						data-ui="ItemSimpleDefaultLine"
					>
						<div
							className="grid justify-items-center gap-2 rounded-2xl bg-selection/75 p-4 backdrop-blur-md"
							data-ui="ItemSimpleDefaultControls"
						>
							{hasRequirements ? (
								<ItemLineInputs
									ownerItemId={ownerItemId}
									line={line}
									idle={false}
									compact
									disabled={disabled || stale}
								/>
							) : null}
							{action}
							{cancel}
						</div>
						{detail.defaultLineDisabled &&
						detail.defaultLineBlockingHint !== undefined ? (
							<p
								className="flex items-center gap-3 rounded-xl bg-surface/90 px-4 py-3 text-base leading-relaxed font-semibold text-accent"
								data-ui="ItemSimpleDefaultBlockingHint"
							>
								<Info className="size-6 shrink-0" />
								<span className="whitespace-pre-wrap">
									{detail.defaultLineBlockingHint}
								</span>
							</p>
						) : null}
					</div>
				)}
			</ItemInfo>
		</div>
	);
};
