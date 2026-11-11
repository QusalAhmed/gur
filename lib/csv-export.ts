import { sanitizeCsvCell } from "@/lib/security";

/**
 * Helper to export any array of records to a CSV file download
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columnMap?: Record<keyof T | string, string>
) {
  if (!data || data.length === 0) return;

  const headers = columnMap
    ? Object.values(columnMap)
    : Object.keys(data[0]);

  const keys = columnMap
    ? Object.keys(columnMap)
    : Object.keys(data[0]);

  const rows = data.map((row) =>
    keys
      .map((key) => {
        const sanitized = sanitizeCsvCell(row[key]);
        // Escape quotes
        const strVal = sanitized.replace(/"/g, '""');
        return `"${strVal}"`;
      })
      .join(",")
  );

  const csvContent = [
    headers.map((h) => `"${sanitizeCsvCell(h).replace(/"/g, '""')}"`).join(","),
    ...rows,
  ].join("\r\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename.replace(/\.csv$/, "")}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
