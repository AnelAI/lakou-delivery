// Delivery statuses that mean "a courier is working on it".
export const ACTIVE_DELIVERY_STATUSES = ["assigned", "confirmed", "picked_up"] as const;
export const FINISHED_DELIVERY_STATUSES = ["delivered", "cancelled"] as const;
