import * as XLSX from "xlsx";
import { StationStatus } from "@/hooks/useStationMonitor";

interface SnapshotRow {
  station_id: string;
  listeners: number;
  peak_listeners: number;
  hour: number;
  recorded_at: string;
}

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

function getMonthlyData(snapshots: SnapshotRow[], stationId: string, monthsAgo: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0, 23, 59, 59);

  const filtered = snapshots.filter(s =>
    s.station_id === stationId &&
    new Date(s.recorded_at) >= start &&
    new Date(s.recorded_at) <= end
  );

  if (filtered.length === 0) return { avg: 0, peak: 0 };

  const avg = Math.round(filtered.reduce((sum, s) => sum + s.listeners, 0) / filtered.length);
  const peak = Math.max(...filtered.map(s => s.peak_listeners));
  return { avg, peak };
}

export function generateAudienceReport(statuses: StationStatus[], snapshots: SnapshotRow[] = []) {
  const wb = XLSX.utils.book_new();
  const quarters = getQuarterLabels();

  // ===== ABA 1: RANKING AUDIÊNCIA =====
  const rows: (string | number | null)[][] = [];
  const headerRow1: (string | null)[] = [
    "TODOS OS DIAS", null,
    "TODOS OS DIAS", null, null, null, null, null, null, null,
    "% MÊS ANTERIOR", null, null,
  ];
  rows.push(headerRow1);

  const headerRow2: (string | null)[] = [
    "6H19", null,
    ...quarters.flatMap((q) => [q.label, null]),
    "Var. Q2/Q1", "Var. Q3/Q2", "Var. Q4/Q3",
  ];
  rows.push(headerRow2);

  const headerRow3: (string | null)[] = [
    "Emissora", null,
    "Pos.", "Audiência", "Pos.", "Audiência",
    "Pos.", "Audiência", "Pos.", "Audiência",
    null, null, null,
  ];
  rows.push(headerRow3);

  const sorted = [...statuses].sort((a, b) => b.listeners - a.listeners);

  // Get quarterly data for each station (Q1=3 months ago, Q4=current)
  const stationQuarterData = sorted.map(s => {
    const q = [
      getMonthlyData(snapshots, s.station.id, 3),
      getMonthlyData(snapshots, s.station.id, 2),
      getMonthlyData(snapshots, s.station.id, 1),
      { avg: s.listeners, peak: s.peakListeners }, // current = live
    ];
    return { station: s, quarters: q };
  });

  // Sort each quarter independently for position
  const quarterPositions = [0, 1, 2, 3].map(qi => {
    const sorted = [...stationQuarterData]
      .sort((a, b) => b.quarters[qi].avg - a.quarters[qi].avg)
      .map((s, idx) => ({ id: s.station.station.id, pos: idx + 1 }));
    return sorted;
  });

  // TOTAL row
  const totals = [0, 1, 2, 3].map(qi =>
    stationQuarterData.reduce((sum, s) => sum + s.quarters[qi].avg, 0)
  );

  const calcVar = (a: number, b: number) => {
    if (b === 0) return "—";
    const pct = ((a - b) / b * 100).toFixed(1);
    return `${Number(pct) > 0 ? '+' : ''}${pct}%`;
  };

  rows.push([
    "NATAL/RN - TOTAL RÁDIO", null,
    null, totals[0], null, totals[1], null, totals[2], null, totals[3],
    calcVar(totals[1], totals[0]), calcVar(totals[2], totals[1]), calcVar(totals[3], totals[2]),
  ]);

  stationQuarterData.forEach(sd => {
    const q = sd.quarters;
    const id = sd.station.station.id;
    const getPos = (qi: number) => quarterPositions[qi].find(p => p.id === id)?.pos ?? 0;
    rows.push([
      `NATAL - ${sd.station.station.name}`, null,
      getPos(0), q[0].avg,
      getPos(1), q[1].avg,
      getPos(2), q[2].avg,
      getPos(3), q[3].avg,
      calcVar(q[1].avg, q[0].avg),
      calcVar(q[2].avg, q[1].avg),
      calcVar(q[3].avg, q[2].avg),
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 35 }, { wch: 2 },
    { wch: 5 }, { wch: 12 }, { wch: 5 }, { wch: 12 },
    { wch: 5 }, { wch: 12 }, { wch: 5 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 10 },
  ];
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 0, c: 2 }, e: { r: 0, c: 9 } },
    { s: { r: 0, c: 10 }, e: { r: 0, c: 12 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    { s: { r: 1, c: 2 }, e: { r: 1, c: 3 } },
    { s: { r: 1, c: 4 }, e: { r: 1, c: 5 } },
    { s: { r: 1, c: 6 }, e: { r: 1, c: 7 } },
    { s: { r: 1, c: 8 }, e: { r: 1, c: 9 } },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Ranking Audiência");

  // ===== ABA 2: HORÁRIOS (07:00 - 22:00) =====
  const hours = Array.from({ length: 16 }, (_, i) => i + 7); // 7..22
  const hourRows: (string | number | null)[][] = [];

  // Header
  hourRows.push(["AUDIÊNCIA POR HORÁRIO - NATAL/RN", ...hours.map(h => `${String(h).padStart(2, '0')}:00`)]);

  // For each station, compute average listeners per hour from snapshots
  sorted.forEach(s => {
    const row: (string | number | null)[] = [s.station.name];
    hours.forEach(h => {
      const hourSnaps = snapshots.filter(snap =>
        snap.station_id === s.station.id && snap.hour === h
      );
      if (hourSnaps.length === 0) {
        // Use live data for current hour if no snapshots
        const now = new Date();
        if (now.getHours() === h) {
          row.push(s.listeners);
        } else {
          row.push(0);
        }
      } else {
        const avg = Math.round(hourSnaps.reduce((sum, snap) => sum + snap.listeners, 0) / hourSnaps.length);
        row.push(avg);
      }
    });
    hourRows.push(row);
  });

  // Total row
  const totalHourRow: (string | number | null)[] = ["TOTAL"];
  hours.forEach((_, hi) => {
    const total = hourRows.slice(1).reduce((sum, row) => sum + (Number(row[hi + 1]) || 0), 0);
    totalHourRow.push(total);
  });
  hourRows.push(totalHourRow);

  const wsHours = XLSX.utils.aoa_to_sheet(hourRows);
  wsHours["!cols"] = [
    { wch: 30 },
    ...hours.map(() => ({ wch: 8 })),
  ];
  XLSX.utils.book_append_sheet(wb, wsHours, "Horários");

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
