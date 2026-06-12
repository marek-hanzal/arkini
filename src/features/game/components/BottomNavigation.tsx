export type ActiveSheet = "inventory" | "database" | "build" | null;
export type BottomNavSheet = "inventory" | "database";

export function BottomNavigation({ activeSheet, onOpen }: Readonly<{ activeSheet: ActiveSheet; onOpen(sheet: BottomNavSheet): void }>) {
  return (
    <nav className="ak-bottom-nav" aria-label="Game panels">
      <div className="ak-bottom-nav-inner">
        <BottomNavButton active={activeSheet === "inventory"} label="Inventory" icon="▦" tone="inventory" onClick={() => onOpen("inventory")} />
        <BottomNavButton active={activeSheet === "database"} label="Database" icon="◈" tone="database" onClick={() => onOpen("database")} />
      </div>
    </nav>
  );
}

function BottomNavButton({ active, label, icon, tone, onClick }: Readonly<{ active: boolean; label: string; icon: string; tone: BottomNavSheet; onClick(): void }>) {
  return (
    <button
      type="button"
      className="ak-bottom-nav-button"
      data-active={active ? "true" : "false"}
      data-tone={tone}
      data-bottom-nav-sheet={tone}
      onClick={onClick}
    >
      <span className="ak-bottom-nav-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
