/** วันเวลาเป็น ISO 8601 UTC ลงท้าย Z */
export const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
