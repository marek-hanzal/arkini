export interface PlannerItemGoalStatus {
	readonly availableCharges: number;
	readonly availableQuantity: number;
	readonly minimumCharges: number;
	readonly satisfied: boolean;
}
