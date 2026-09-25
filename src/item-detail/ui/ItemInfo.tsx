import { match } from "ts-pattern";
import type { useItemDetailSceneController } from "~/item-detail/ui/useItemDetailSceneController";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Fact, FactList } from "~/ui/ui/FactList";
import { ItemArtwork } from "~/ui/ui/ItemArtwork";

interface ItemInfoProps {
	readonly detail: useItemDetailSceneController.Detail;
	readonly stale: boolean;
}

/** The player's basic item facts, without authoring controls or resource identifiers. */
export const ItemInfo = ({ detail, stale }: ItemInfoProps) => {
	const translator = useTranslator();
	const depleted =
		detail.units === undefined
			? 0
			: Math.max(0, Math.min(1, 1 - detail.units.remaining / detail.units.total));
	return (
		<section
			className="flex items-center justify-center p-6"
			data-ui="ItemInfo"
		>
			<div className="grid w-full max-w-5xl grid-cols-2 items-center gap-12">
				<div
					className="relative isolate aspect-square w-full max-w-md justify-self-center"
					data-ui="ItemInfoArtwork"
				>
					<ItemArtwork
						className="size-full"
						sourceUrl={detail.sourceUrl}
						compositeUrl={detail.compositeUrl}
						colorFraction={1 - depleted}
					/>
				</div>
				<div className="grid min-w-0 gap-8">
					<h2 className="text-3xl font-semibold leading-tight">
						{detail.title}
						{stale ? ` · ${translator.textFn("Gone")}` : null}
					</h2>
					{detail.description ? (
						<p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
							{detail.description}
						</p>
					) : null}

					<div className="grid grid-cols-2 items-start gap-8">
						<FactList columns={1}>
							<Fact
								label={translator.textFn("Units remaining")}
								value={match(detail.units)
									.with(undefined, () =>
										translator.textFn("This item doesn't use units."),
									)
									.with(
										{
											remaining: 0,
										},
										() => translator.textFn("Depleted"),
									)
									.otherwise(({ remaining, total }) => `${remaining}/${total}`)}
							/>
						</FactList>
					</div>
				</div>
			</div>
		</section>
	);
};
