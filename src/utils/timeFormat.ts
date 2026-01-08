/**
 * Utility functions for time formatting
 * Always use hours and minutes format, NEVER decimals
 */

/**
 * Convert minutes to hours and minutes format
 * @param totalMinutes Total minutes
 * @returns Object with hours and minutes
 */
export const minutesToHoursMinutes = (totalMinutes: number): { hours: number; minutes: number } => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours, minutes };
};

/**
 * Format minutes as "Xh Ymin" string
 * @param totalMinutes Total minutes
 * @returns Formatted string like "9h 30min" or "8h 0min"
 */
export const formatMinutesAsTime = (totalMinutes: number): string => {
  const { hours, minutes } = minutesToHoursMinutes(totalMinutes);
  return `${hours}h ${minutes}min`;
};

/**
 * Format minutes as short time string "X:YY"
 * @param totalMinutes Total minutes
 * @returns Formatted string like "9:30" or "8:00"
 */
export const formatMinutesAsShortTime = (totalMinutes: number): string => {
  const { hours, minutes } = minutesToHoursMinutes(totalMinutes);
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
};

/**
 * Calculate benefit for TURNO_EXTRA proportional to minutes
 * Formula: (actual_worked_minutes - expected_warehouse_minutes) / 60 * hourly_rate
 *
 * @param actualWorkedMinutes Net minutes actually worked (after breaks)
 * @param expectedWarehouseMinutes Net minutes expected for warehouse shift (default 480 = 8 hours)
 * @param hourlyRate Hourly rate in euros
 * @returns Benefit amount in euros (rounded to 2 decimals)
 */
export const calculateExtraShiftBenefit = (
  actualWorkedMinutes: number,
  expectedWarehouseMinutes: number = 480, // 8 hours default
  hourlyRate: number
): number => {
  const extraMinutes = actualWorkedMinutes - expectedWarehouseMinutes;

  // Only pay if worked more than expected
  if (extraMinutes <= 0) {
    return 0;
  }

  // Proportional calculation: (minutes / 60) * hourly_rate
  const benefit = (extraMinutes / 60) * hourlyRate;

  // Round to 2 decimals
  return Math.round(benefit * 100) / 100;
};

/**
 * Get benefit calculation details for display
 *
 * @param actualWorkedMinutes Net minutes actually worked
 * @param expectedWarehouseMinutes Net minutes expected (default 480 = 8 hours)
 * @param hourlyRate Hourly rate
 * @returns Object with calculation details
 */
export const getExtraShiftBenefitDetails = (
  actualWorkedMinutes: number,
  expectedWarehouseMinutes: number = 480,
  hourlyRate: number
) => {
  const extraMinutes = actualWorkedMinutes - expectedWarehouseMinutes;
  const benefit = calculateExtraShiftBenefit(actualWorkedMinutes, expectedWarehouseMinutes, hourlyRate);

  return {
    actualWorkedMinutes,
    actualWorkedFormatted: formatMinutesAsTime(actualWorkedMinutes),
    expectedWarehouseMinutes,
    expectedWarehouseFormatted: formatMinutesAsTime(expectedWarehouseMinutes),
    extraMinutes: Math.max(0, extraMinutes),
    extraMinutesFormatted: extraMinutes > 0 ? formatMinutesAsTime(extraMinutes) : '0h 0min',
    hourlyRate,
    benefit,
    hasBenefit: extraMinutes > 0
  };
};
