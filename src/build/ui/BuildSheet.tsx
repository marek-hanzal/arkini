import { usePlayBuildRecipes } from "~/play/hook/usePlayBuildRecipes";
import { usePlayItems } from "~/play/hook/usePlayItems";
import type { BuildRecipeId } from "~/manifest/data/manifestId";
import type { BoardCell } from "~/board/boardIdentity";
import { SheetHeader } from "~/shared/ui/SheetHeader";

export namespace BuildSheet {
	export interface Props {
		cell: BoardCell | null;
		onClose(): void;
		onBuild(recipeId: BuildRecipeId): void;
	}
}

export function BuildSheet({ cell, onClose, onBuild }: BuildSheet.Props) {
	const buildRecipes = usePlayBuildRecipes().data;
	const items = usePlayItems().data;

	if (!buildRecipes || !items) return null;

	return (
		<div>
			<SheetHeader
				eyebrow="Build"
				description={cell ? `Cell ${cell.x}:${cell.y}` : "Choose an empty board cell"}
				onClose={onClose}
			/>

			{cell ? (
				<div className="grid gap-2 p-4 pt-1">
					{buildRecipes.map((recipe) => {
						const result = items[recipe.resultItemId];
						const blueprint = items[recipe.blueprintItemId];
						return (
							<button
								key={recipe.id}
								type="button"
								disabled={!recipe.canBuild}
								className="flex items-center gap-3 rounded-sm border border-slate-800 bg-slate-900/80 p-2 text-left disabled:opacity-40"
								onClick={() => onBuild(recipe.id)}
							>
								<img
									src={result.assetSrc}
									alt=""
									className="h-10 w-10 object-contain"
								/>
								<span className="min-w-0 flex-1">
									<span className="block text-sm font-semibold text-slate-100">
										{result.name}
									</span>
									<span className="block truncate text-xs text-slate-400">
										{blueprint.name} +{" "}
										{recipe.costs
											.map(
												(cost) =>
													`${cost.quantity}x ${items[cost.itemId]?.name ?? cost.itemId}`,
											)
											.join(", ")}
									</span>
								</span>
							</button>
						);
					})}
				</div>
			) : (
				<p className="m-4 mt-1 rounded-sm border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-400">
					Double-click an empty board cell to build there.
				</p>
			)}
		</div>
	);
}
