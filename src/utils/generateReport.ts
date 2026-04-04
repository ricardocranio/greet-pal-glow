import * as XLSX from "xlsx";
import { StationStatus } from "@/hooks/useStationMonitor";

function getQuarterLabels(): { label: string; shortLabel: string }[] {
  const now = new Date();
  const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const quarters: { label: string; shortLabel: string }[] = [];

  for (let i = 3; i >= 0; i--) {
    const endDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 2, 1);
    const startMonth = months[startDate.getMonth()];
    const endMonth = months[endDate.getMonth()];
    const startYear = String(startDate.getFullYear()).slice(2);
    const endYear = String(endDate.getFullYear()).slice(2);
    quarters.push({
      label: `${startMonth} A ${endMonth}${startYear !== endYear ? endYear : startYear}`,
      shortLabel: `${startMonth}${startYear}-${endMonth}${endYear}`,
    });
  }
  return quarters;
}

export function generateAudienceReport(statuses: StationStatus[]) {
  const wb = XLSX.utils.book_new();
  const quarters = getQuarterLabels();

  // Build header rows
  const rows: (string | number | null)[][] = [];

  // Row 1: merged header areas
  const headerRow1: (string | null)[] = [
    "TODOS OS DIAS",
    null,
    "TODOS OS DIAS",
    null, null, null, null, null, null, null,
    "% MÊS ANTERIOR",
    null, null,
  ];
  rows.push(headerRow1);

  // Row 2: sub-headers
  const headerRow2: (string | null)[] = [
    "6H19",
    null,
    ...quarters.flatMap((q) => [q.label, null]),
    "Var. Q2/Q1",
    "Var. Q3/Q2",
    "Var. Q4/Q3",
  ];
  rows.push(headerRow2);

  // Row 3: column sub-headers
  const headerRow3: (string | null)[] = [
    "Emissora",
    null,
    "Pos.", "Audiência",
    "Pos.", "Audiência",
    "Pos.", "Audiência",
    "Pos.", "Audiência",
    null, null, null,
  ];
  rows.push(headerRow3);

  // Sort stations by current listeners descending
  const sorted = [...statuses].sort((a, b) => b.listeners - a.listeners);

  // TOTAL row
  const totalListeners = sorted.reduce((sum, s) => sum + s.listeners, 0);
  rows.push([
    "NATAL/RN - TOTAL RÁDIO",
    null,
    null, totalListeners,
    null, totalListeners,
    null, totalListeners,
    null, totalListeners,
    "0%", "0%", "0%",
  ]);

  // Station rows
  sorted.forEach((s, idx) => {
    const pos = idx + 1;
    const listeners = s.listeners;
    rows.push([
      `NATAL - ${s.station.name}`,
      null,
      pos, listeners,
      pos, listeners,
      pos, listeners,
      pos, listeners,
      "0%", "0%", "0%",
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  ws["!cols"] = [
    { wch: 35 }, // Station name
    { wch: 2 },  // spacer
    { wch: 5 },  // Pos Q1
    { wch: 12 }, // Aud Q1
    { wch: 5 },  // Pos Q2
    { wch: 12 }, // Aud Q2
    { wch: 5 },  // Pos Q3
    { wch: 12 }, // Aud Q3
    { wch: 5 },  // Pos Q4
    { wch: 12 }, // Aud Q4
    { wch: 10 }, // Var 1
    { wch: 10 }, // Var 2
    { wch: 10 }, // Var 3
  ];

  // Merge cells for headers
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },   // TODOS OS DIAS (left)
    { s: { r: 0, c: 2 }, e: { r: 0, c: 9 } },    // TODOS OS DIAS (center)
    { s: { r: 0, c: 10 }, e: { r: 0, c: 12 } },  // % MÊS ANTERIOR
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },    // 6H19
    { s: { r: 1, c: 2 }, e: { r: 1, c: 3 } },    // Q1
    { s: { r: 1, c: 4 }, e: { r: 1, c: 5 } },    // Q2
    { s: { r: 1, c: 6 }, e: { r: 1, c: 7 } },    // Q3
    { s: { r: 1, c: 8 }, e: { r: 1, c: 9 } },    // Q4
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Ranking Audiência");

  // Generate and download
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ranking_audiencia_natal_rn_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
