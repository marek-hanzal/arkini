import type { GameView } from "@arkini/db";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { match } from "ts-pattern";
import { useGameAction, useGameView } from "~/hooks/useGameView";

type Selection =
  | { type: "inventory"; slotIndex: number }
  | { type: "board"; boardItemId: string }
  | { type: "build"; recipeId: string }
  | null;

export function GameShell() {
  const game = useGameView();
  const [selection, setSelection] = useState<Selection>(null);
  const [message, setMessage] = useState("Vyber stack, item na boardu, nebo blueprint build. Ano, buttons-first UX, protože drag doděláme až nebude hořet DB.");

  const placeInventory = useGameAction((db, input: { slotIndex: number; x: number; y: number }) =>
    db.placeInventoryItem(input.slotIndex, input.x, input.y),
  );
  const stashBoard = useGameAction((db, input: { boardItemId: string }) => db.stashBoardItem(input.boardItemId));
  const mergeBoard = useGameAction((db, input: { sourceBoardItemId: string; targetBoardItemId: string }) =>
    db.mergeBoardItems(input.sourceBoardItemId, input.targetBoardItemId),
  );
  const produce = useGameAction((db, input: { boardItemId: string }) => db.produceBoardItem(input.boardItemId));
  const build = useGameAction((db, input: { recipeId: string; x: number; y: number }) =>
    db.buildRecipe(input.recipeId, input.x, input.y),
  );
  const reset = useGameAction((db) => db.resetDefaultSaveGame());

  const pending = placeInventory.isPending || stashBoard.isPending || mergeBoard.isPending || produce.isPending || build.isPending || reset.isPending;
  const error = placeInventory.error ?? stashBoard.error ?? mergeBoard.error ?? produce.error ?? build.error ?? reset.error;

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      setSelection(null);
      setMessage(success);
    } catch {
      // React Query stores the error; we render it below. Duplicating error state
      // would be a tiny monument to frontend overthinking.
    }
  }

  if (game.isLoading) {
    return <GameCard title="Loading game">Probouzím OPFS SQLite. Browser zrovna hledá svoje papíry.</GameCard>;
  }

  if (game.isError) {
    return <GameCard title="Game failed">{(game.error as Error).message}</GameCard>;
  }

  if (!game.data) return null;

  return (
    <section className="grid gap-8 xl:grid-cols-[1fr_24rem]">
      <div className="flex flex-col gap-6">
        <GameBoard
          game={game.data}
          selection={selection}
          pending={pending}
          onSelect={setSelection}
          onMessage={setMessage}
          onPlace={(slotIndex, x, y) => run(() => placeInventory.mutateAsync({ slotIndex, x, y }), "Item placed on board.")}
          onBuild={(recipeId, x, y) => run(() => build.mutateAsync({ recipeId, x, y }), "Built item on board.")}
          onMerge={(sourceBoardItemId, targetBoardItemId) =>
            run(() => mergeBoard.mutateAsync({ sourceBoardItemId, targetBoardItemId }), "Merged into the next level.")
          }
        />
        <InventoryPanel game={game.data} selection={selection} pending={pending} onSelect={setSelection} />
      </div>

      <aside className="flex flex-col gap-6">
        <ActionPanel
          game={game.data}
          selection={selection}
          pending={pending}
          message={message}
          onSelect={setSelection}
          onStash={(boardItemId) => run(() => stashBoard.mutateAsync({ boardItemId }), "Stored item in inventory.")}
          onProduce={(boardItemId) => run(() => produce.mutateAsync({ boardItemId }), "Producer dropped items around itself.")}
          onReset={() => run(() => reset.mutateAsync(undefined), "Save reset to manifest starting state.")}
        />
        {error ? <p className="rounded-3xl border border-red-400/30 bg-red-950/40 p-4 text-sm text-red-100">{(error as Error).message}</p> : null}
      </aside>
    </section>
  );
}

function GameBoard({
  game,
  selection,
  pending,
  onSelect,
  onMessage,
  onPlace,
  onBuild,
  onMerge,
}: Readonly<{
  game: GameView;
  selection: Selection;
  pending: boolean;
  onSelect(selection: Selection): void;
  onMessage(message: string): void;
  onPlace(slotIndex: number, x: number, y: number): void;
  onBuild(recipeId: string, x: number, y: number): void;
  onMerge(sourceBoardItemId: string, targetBoardItemId: string): void;
}>) {
  const itemByCell = useMemo(
    () => new Map(game.boardItems.map((item) => [`${item.x}:${item.y}`, item])),
    [game.boardItems],
  );
  const cells = Array.from({ length: game.save.boardWidth * game.save.boardHeight }, (_, index) => ({
    x: index % game.save.boardWidth,
    y: Math.floor(index / game.save.boardWidth),
  }));

  function clickCell(x: number, y: number) {
    const boardItem = itemByCell.get(`${x}:${y}`);

    if (!boardItem) {
      match(selection)
        .with({ type: "inventory" }, ({ slotIndex }) => onPlace(slotIndex, x, y))
        .with({ type: "build" }, ({ recipeId }) => onBuild(recipeId, x, y))
        .otherwise(() => onMessage("Empty cell. Vyber inventory stack nebo build recipe a pak sem klikni."));
      return;
    }

    match(selection)
      .with({ type: "board" }, ({ boardItemId }) => {
        if (boardItemId === boardItem.id) {
          onSelect(null);
          return;
        }
        onMerge(boardItemId, boardItem.id);
      })
      .otherwise(() => onSelect({ type: "board", boardItemId: boardItem.id }));
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">Board</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Merge + producer space</h2>
        </div>
        <p className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-400">1×1 only</p>
      </div>

      <div className="mt-5 grid gap-2" style={{ gridTemplateColumns: `repeat(${game.save.boardWidth}, minmax(0, 1fr))` }}>
        {cells.map((cell) => {
          const boardItem = itemByCell.get(`${cell.x}:${cell.y}`);
          const item = boardItem ? game.items[boardItem.itemId] : null;
          const selected = selection?.type === "board" && selection.boardItemId === boardItem?.id;

          return (
            <button
              key={`${cell.x}:${cell.y}`}
              type="button"
              disabled={pending}
              onClick={() => clickCell(cell.x, cell.y)}
              className={[
                "aspect-square rounded-2xl border p-2 text-left shadow-inner shadow-black/30 transition",
                selected ? "border-emerald-300 bg-emerald-950/50" : "border-slate-800 bg-slate-950/80 hover:border-slate-500",
              ].join(" ")}
            >
              {item ? (
                <div className="flex h-full flex-col items-center justify-center gap-1">
                  <img src={item.assetSrc} alt="" className="h-10 w-10 sm:h-12 sm:w-12" />
                  <span className="line-clamp-1 text-center text-[0.65rem] font-medium text-slate-200">{item.name}</span>
                </div>
              ) : (
                <span className="flex h-full items-center justify-center text-xs text-slate-700">{cell.x},{cell.y}</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function InventoryPanel({
  game,
  selection,
  pending,
  onSelect,
}: Readonly<{
  game: GameView;
  selection: Selection;
  pending: boolean;
  onSelect(selection: Selection): void;
}>) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/40">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-300">Inventory</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Limited stack storage</h2>
      <div className="mt-5 grid grid-cols-6 gap-2 md:grid-cols-9">
        {game.inventory.map((slot) => {
          const item = slot.stack ? game.items[slot.stack.itemId] : null;
          const selected = selection?.type === "inventory" && selection.slotIndex === slot.slotIndex;

          return (
            <button
              key={slot.slotIndex}
              type="button"
              disabled={pending || !slot.stack}
              onClick={() => onSelect(selected ? null : { type: "inventory", slotIndex: slot.slotIndex })}
              className={[
                "relative aspect-square rounded-2xl border p-2 transition",
                selected ? "border-sky-300 bg-sky-950/50" : "border-slate-800 bg-slate-950/80 hover:border-slate-500",
                !slot.stack ? "opacity-50" : "",
              ].join(" ")}
            >
              {item && slot.stack ? (
                <>
                  <img src={item.assetSrc} alt="" className="mx-auto h-9 w-9" />
                  <span className="absolute bottom-1 right-2 rounded-full bg-slate-900 px-1.5 text-xs font-bold text-slate-100">
                    {slot.stack.quantity}
                  </span>
                </>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ActionPanel({
  game,
  selection,
  pending,
  message,
  onSelect,
  onStash,
  onProduce,
  onReset,
}: Readonly<{
  game: GameView;
  selection: Selection;
  pending: boolean;
  message: string;
  onSelect(selection: Selection): void;
  onStash(boardItemId: string): void;
  onProduce(boardItemId: string): void;
  onReset(): void;
}>) {
  const selectedBoardItem = selection?.type === "board" ? game.boardItems.find((item) => item.id === selection.boardItemId) : null;
  const selectedItem = selectedBoardItem ? game.items[selectedBoardItem.itemId] : null;

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/40">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">Actions</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Small blocks, no ceremony</h2>
      <p className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-sm leading-6 text-slate-300">{message}</p>

      {selectedItem && selectedBoardItem ? (
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex items-center gap-3">
            <img src={selectedItem.assetSrc} alt="" className="h-12 w-12" />
            <div>
              <p className="font-semibold text-white">{selectedItem.name}</p>
              <p className="text-xs text-slate-400">{selectedItem.description}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            <button type="button" disabled={pending} onClick={() => onStash(selectedBoardItem.id)} className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">
              Store in inventory
            </button>
            {selectedItem.canProduce ? (
              <button type="button" disabled={pending} onClick={() => onProduce(selectedBoardItem.id)} className="rounded-2xl bg-emerald-300 px-4 py-2 text-sm font-bold text-emerald-950 disabled:opacity-50">
                Produce around item
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <BuildPanel game={game} selection={selection} pending={pending} onSelect={onSelect} />

      <button type="button" disabled={pending} onClick={onReset} className="mt-4 w-full rounded-2xl border border-red-400/30 bg-red-950/30 px-4 py-2 text-sm font-bold text-red-100 disabled:opacity-50">
        Reset save
      </button>
    </section>
  );
}

function BuildPanel({
  game,
  selection,
  pending,
  onSelect,
}: Readonly<{
  game: GameView;
  selection: Selection;
  pending: boolean;
  onSelect(selection: Selection): void;
}>) {
  return (
    <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-sm font-semibold text-white">Blueprint builds</p>
      <div className="mt-3 grid gap-3">
        {game.buildRecipes.map((recipe) => {
          const result = game.items[recipe.resultItemId];
          const blueprint = game.items[recipe.blueprintItemId];
          const selected = selection?.type === "build" && selection.recipeId === recipe.id;

          return (
            <button
              key={recipe.id}
              type="button"
              disabled={pending || !recipe.canBuild}
              onClick={() => onSelect(selected ? null : { type: "build", recipeId: recipe.id })}
              className={[
                "rounded-2xl border p-3 text-left transition disabled:opacity-40",
                selected ? "border-amber-300 bg-amber-950/40" : "border-slate-800 bg-slate-900/60 hover:border-slate-500",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <img src={result.assetSrc} alt="" className="h-10 w-10" />
                <div>
                  <p className="font-semibold text-slate-100">Build {result.name}</p>
                  <p className="text-xs text-slate-400">Consumes {blueprint.name}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {recipe.costs.map((cost) => `${game.items[cost.itemId].name} × ${cost.quantity}`).join(", ")}
              </p>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">Vyber build a klikni na prázdný slot. Craft bere suroviny z inventáře, board je jen placement.</p>
    </div>
  );
}

function GameCard({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/40">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">Arkini</p>
      <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
      <p className="mt-4 text-sm leading-6 text-slate-300">{children}</p>
    </section>
  );
}
