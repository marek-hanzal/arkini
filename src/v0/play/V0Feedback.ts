export interface V0Feedback {
	pulseMergeCell(key: string | undefined): void;
	pulseImprintCell(key: string | undefined): void;
	flashBoardCell(key: string | undefined): void;
	flashInventorySlot(slotIndex: number | undefined): void;
	showError(error: unknown): void;
}
