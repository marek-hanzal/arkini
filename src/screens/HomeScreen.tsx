import { DbStatusCard } from "~/components/DbStatusCard";
import { GameShell } from "~/features/game/GameShell";

export function HomeScreen() {
  return (
    <main
      className="mx-auto flex min-h-screen w-fit max-w-full flex-col items-center gap-4 px-3 py-3"
      style={{ paddingBottom: "calc(8rem + env(safe-area-inset-bottom))" }}
    >
      <GameShell />
      <div className="w-[min(100vw-1.5rem,430px)]">
        <DbStatusCard />
      </div>
    </main>
  );
}
