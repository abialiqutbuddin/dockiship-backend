/**
 * Inventory Cost Utilities
 * 
 * Reusable functions for calculating landed costs and weighted average costs.
 * Used across Purchase Orders, Inventory Adjustments, and Order prefilling.
 */

import { Decimal } from '@prisma/client/runtime/library';

/**
 * Represents a purchase order item for cost calculations
 */
export interface POItemForCost {
    quantity: number;
    unitPrice: number | Decimal | null;
    taxAmount?: number | Decimal | null;
    taxRate?: number | Decimal | null;
}

/**
 * Represents PO-level totals for shipping allocation
 */
export interface POTotalsForShipping {
    shippingCost?: number | Decimal | null;
    shippingTax?: number | Decimal | null;
}

/**
 * Result of landed cost calculation for a single PO item
 */
export interface LandedCostResult {
    allocatedShipping: number;
    taxPerUnit: number;
    shippingPerUnit: number;
    landedCostPerUnit: number;
}

/**
 * Converts a Prisma Decimal or number to a plain number
 */
export function toNumber(value: number | Decimal | null | undefined): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    return Number(value);
}

/**
 * Calculates shipping per unit by dividing total shipping equally among all units.
 * 
 * @param items - Array of PO items with quantities
 * @param poTotals - PO-level shipping costs
 * @returns Shipping amount per unit
 */
export function calculateShippingPerUnit(
    items: { quantity: number }[],
    poTotals: POTotalsForShipping
): number {
    const totalQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    if (totalQty === 0) return 0;

    const totalShipping = toNumber(poTotals.shippingCost) + toNumber(poTotals.shippingTax);
    return totalShipping / totalQty;
}

/**
 * Calculates the landed cost for a single PO item.
 * Landed cost = unit price + tax per unit + shipping per unit
 * 
 * @param item - The PO item
 * @param shippingPerUnit - Pre-calculated shipping per unit
 * @returns LandedCostResult with breakdown
 */
export function calculateItemLandedCost(
    item: POItemForCost,
    shippingPerUnit: number
): LandedCostResult {
    const unitPrice = toNumber(item.unitPrice);
    const quantity = item.quantity || 0;

    // Calculate tax per unit
    let taxPerUnit = 0;
    if (item.taxAmount !== null && item.taxAmount !== undefined) {
        taxPerUnit = quantity > 0 ? toNumber(item.taxAmount) / quantity : 0;
    } else if (item.taxRate !== null && item.taxRate !== undefined) {
        taxPerUnit = unitPrice * (toNumber(item.taxRate) / 100);
    }

    // Calculate allocated shipping for this line
    const allocatedShipping = quantity * shippingPerUnit;

    // Landed cost per unit
    const landedCostPerUnit = unitPrice + taxPerUnit + shippingPerUnit;

    return {
        allocatedShipping,
        taxPerUnit,
        shippingPerUnit,
        landedCostPerUnit,
    };
}

/**
 * Calculates landed costs for all items in a PO.
 * 
 * @param items - Array of PO items
 * @param poTotals - PO-level shipping costs
 * @returns Map of item index to LandedCostResult
 */
export function calculatePOLandedCosts<T extends POItemForCost>(
    items: T[],
    poTotals: POTotalsForShipping
): Map<number, LandedCostResult> {
    const shippingPerUnit = calculateShippingPerUnit(items, poTotals);
    const results = new Map<number, LandedCostResult>();

    items.forEach((item, index) => {
        results.set(index, calculateItemLandedCost(item, shippingPerUnit));
    });

    return results;
}

/**
 * Represents the current stock state for weighted average calculation
 */
export interface CurrentStockState {
    stockOnHand: number;
    avgCostPerUnit: number | Decimal | null;
}

/**
 * Represents incoming stock for weighted average calculation
 */
export interface IncomingStock {
    quantity: number;
    costPerUnit: number;
}

/**
 * Result of weighted average cost calculation
 */
export interface WeightedAvgResult {
    newAvgCostPerUnit: number;
    newTotalStock: number;
    previousValue: number;
    incomingValue: number;
    totalValue: number;
}

/**
 * Calculates the new weighted average cost when adding stock.
 * 
 * Formula: newAvgCost = (existingStock × existingAvgCost + newStock × newCost) / totalStock
 * 
 * @param currentState - Current stock and avg cost
 * @param incomingStock - Incoming quantity and cost per unit
 * @returns WeightedAvgResult with the new average cost
 * 
 * @example
 * // Existing: 300 units @ $1.90, New: 1000 units @ $2.00
 * const result = calculateWeightedAvgCost(
 *   { stockOnHand: 300, avgCostPerUnit: 1.90 },
 *   { quantity: 1000, costPerUnit: 2.00 }
 * );
 * // result.newAvgCostPerUnit = 1.9769... (~$1.98)
 */
export function calculateWeightedAvgCost(
    currentState: CurrentStockState,
    incomingStock: IncomingStock
): WeightedAvgResult {
    const currentStock = currentState.stockOnHand || 0;
    const currentAvgCost = toNumber(currentState.avgCostPerUnit);

    const previousValue = currentStock * currentAvgCost;
    const incomingValue = incomingStock.quantity * incomingStock.costPerUnit;
    const totalValue = previousValue + incomingValue;
    const newTotalStock = currentStock + incomingStock.quantity;

    // If no stock after operation (shouldn't happen when adding), use incoming cost
    const newAvgCostPerUnit = newTotalStock > 0
        ? totalValue / newTotalStock
        : incomingStock.costPerUnit;

    return {
        newAvgCostPerUnit,
        newTotalStock,
        previousValue,
        incomingValue,
        totalValue,
    };
}

/**
 * Recalculates avg cost after a manual stock adjustment.
 * 
 * - For positive adjustments (adding stock): cost input is required
 * - For negative adjustments (removing stock): avg cost remains unchanged
 * 
 * @param currentState - Current stock and avg cost
 * @param qtyDelta - Quantity change (positive = add, negative = remove)
 * @param costPerUnit - Cost per unit (required if qtyDelta > 0)
 * @returns New average cost per unit, or null if unchanged
 * @throws Error if adding stock without cost
 */
export function calculateAdjustedAvgCost(
    currentState: CurrentStockState,
    qtyDelta: number,
    costPerUnit?: number | null
): number | null {
    // Stock reduction: avg cost unchanged
    if (qtyDelta <= 0) {
        return null; // Signal to keep existing avgCostPerUnit
    }

    // Stock increase: cost required
    if (costPerUnit === null || costPerUnit === undefined) {
        throw new Error('Cost per unit is required when increasing stock');
    }

    const result = calculateWeightedAvgCost(currentState, {
        quantity: qtyDelta,
        costPerUnit,
    });

    return result.newAvgCostPerUnit;
}
