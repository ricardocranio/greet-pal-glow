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
    quarters.push({
      label: `${months[startDate.getMonth()]} A ${months[endDate.getMonth()]}${String(endDate.getFullYear()).slice(2)}`,
      shortLabel: `${months[startDate.getMonth()]}${String(startDate.getFullYear()).slice(2)}-${months[endDate.getMonth()]}${String(endDate.getFullYear()).slice(2)}`,
    });
  }
  return quarters;
}

function getMonthlyData(snapshots: SnapshotRow[], stationId: string, monthsAgo: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0, 23, 59, 59);
  const filtered = snapshots.filter(s =>
    s.station_id === stationId && new Date(s.recorded_at) >= start && new Date(s.recorded_at) <= end
  );
  if (filtered.length === 0) return { avg: 0, peak: 0 };
  return {
    avg: Math.round(filtered.reduce((sum, s) => sum + s.listeners, 0) / filtered.length),
    peak: Math.max(...filtered.map(s => s.peak_listeners)),
  };
}

const calcVar = (a: number, b: number) => {
  if (b === 0) return "—";
  const pct = ((a - b) / b * 100).toFixed(1);
  return `${Number(pct) > 0 ? '+' : ''}${pct}%`;
};

export function generateAudienceReport(statuses: StationStatus[], snapshots: SnapshotRow[] = []) {
  const wb = XLSX.utils.book_new();
  const quarters = getQuarterLabels();
  const sorted = [...statuses].sort((a, b) => b.listeners - a.listeners);

  // ===== ABA 1: RANKING AUDIÊNCIA =====
  const cleanName = (name: string) => name.replace(/ NATAL/gi, "").replace(/DE /gi, "").trim();

  const rows: (string | number | null)[][] = [];
  rows.push(["TODOS OS DIAS", null, null, "TODOS OS DIAS", null, null, null, null, null, null, null, "% MÊS ANTERIOR", null, null]);
  rows.push([null, null, null, ...quarters.flatMap((q) => [q.label, null]), "Var. Q2/Q1", "Var. Q3/Q2", "Var. Q4/Q3"]);
  rows.push(["Emissora", "Logo", null, "Pos.", "Audiência", "Pos.", "Audiência", "Pos.", "Audiência", "Pos.", "Audiência", null, null, null]);

  const stationQuarterData = sorted.map(s => ({
    station: s,
    quarters: [
      getMonthlyData(snapshots, s.station.id, 3),
      getMonthlyData(snapshots, s.station.id, 2),
      getMonthlyData(snapshots, s.station.id, 1),
      { avg: s.listeners, peak: s.peakListeners },
    ],
  }));

  const quarterPositions = [0, 1, 2, 3].map(qi =>
    [...stationQuarterData].sort((a, b) => b.quarters[qi].avg - a.quarters[qi].avg).map((s, idx) => ({ id: s.station.station.id, pos: idx + 1 }))
  );

  const totals = [0, 1, 2, 3].map(qi => stationQuarterData.reduce((sum, s) => sum + s.quarters[qi].avg, 0));
  rows.push(["TOTAL RÁDIO", null, null, null, totals[0], null, totals[1], null, totals[2], null, totals[3],
    calcVar(totals[1], totals[0]), calcVar(totals[2], totals[1]), calcVar(totals[3], totals[2])]);

  stationQuarterData.forEach(sd => {
    const q = sd.quarters;
    const id = sd.station.station.id;
    const getPos = (qi: number) => quarterPositions[qi].find(p => p.id === id)?.pos ?? 0;
    rows.push([cleanName(sd.station.station.name), sd.station.station.logoUrl, null, getPos(0), q[0].avg, getPos(1), q[1].avg, getPos(2), q[2].avg, getPos(3), q[3].avg,
      calcVar(q[1].avg, q[0].avg), calcVar(q[2].avg, q[1].avg), calcVar(q[3].avg, q[2].avg)]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 25 }, { wch: 40 }, { wch: 2 }, { wch: 5 }, { wch: 12 }, { wch: 5 }, { wch: 12 }, { wch: 5 }, { wch: 12 }, { wch: 5 }, { wch: 12 }, { wch: 10, hidden: true }, { wch: 10, hidden: true }, { wch: 10, hidden: true }];
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, { s: { r: 0, c: 3 }, e: { r: 0, c: 10 } }, { s: { r: 0, c: 11 }, e: { r: 0, c: 13 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }, { s: { r: 1, c: 3 }, e: { r: 1, c: 4 } }, { s: { r: 1, c: 5 }, e: { r: 1, c: 6 } },
    { s: { r: 1, c: 7 }, e: { r: 1, c: 8 } }, { s: { r: 1, c: 9 }, e: { r: 1, c: 10 } },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Ranking Audiência");

  // ===== ABA 2: AUDIÊNCIA POR HORÁRIO =====
  const hours = Array.from({ length: 16 }, (_, i) => i + 7);
  const hourRows: (string | number | null)[][] = [];
  hourRows.push(["Emissora", "Logo", ...hours.map(h => `${String(h).padStart(2, '0')}:00`), "TOTAL"]);

  sorted.forEach(s => {
    const row: (string | number)[] = [cleanName(s.station.name), s.station.logoUrl];
    let stationTotal = 0;
    hours.forEach(h => {
      const hourSnaps = snapshots.filter(snap => snap.station_id === s.station.id && snap.hour === h);
      const val = hourSnaps.length > 0
        ? Math.round(hourSnaps.reduce((sum, snap) => sum + snap.listeners, 0) / hourSnaps.length)
        : (new Date().getHours() === h ? s.listeners : 0);
      stationTotal += val;
      row.push(val);
    });
    row.push(stationTotal);
    hourRows.push(row);
  });

  const totalHourRow: (string | number)[] = ["TOTAL"];
  let grandTotal = 0;
  hours.forEach((_, hi) => {
    const total = hourRows.slice(1).reduce((sum, row) => sum + (Number(row[hi + 1]) || 0), 0);
    grandTotal += total;
    totalHourRow.push(total);
  });
  totalHourRow.push(grandTotal);
  hourRows.push(totalHourRow);

  const wsHours = XLSX.utils.aoa_to_sheet(hourRows);
  wsHours["!cols"] = [{ wch: 30 }, ...hours.map(() => ({ wch: 8 })), { wch: 10, hidden: true }];
  XLSX.utils.book_append_sheet(wb, wsHours, "Audiência por Horário");

  // ===== ABA 3: AUDIÊNCIA POR DIA =====
  const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const dayRows: (string | number | null)[][] = [];
  dayRows.push(["AUDIÊNCIA POR DIA - NATAL/RN", ...dayNames, "TOTAL"]);

  sorted.forEach(s => {
    const row: (string | number)[] = [s.station.name];
    let stationTotal = 0;
    [0, 1, 2, 3, 4, 5, 6].forEach(dayIdx => {
      const daySnaps = snapshots.filter(snap => {
        const d = new Date(snap.recorded_at);
        return snap.station_id === s.station.id && d.getDay() === dayIdx;
      });
      const val = daySnaps.length > 0
        ? Math.round(daySnaps.reduce((sum, snap) => sum + snap.listeners, 0) / daySnaps.length)
        : (new Date().getDay() === dayIdx ? s.listeners : 0);
      stationTotal += val;
      row.push(val);
    });
    row.push(stationTotal);
    dayRows.push(row);
  });

  const totalDayRow: (string | number)[] = ["TOTAL"];
  let dayGrandTotal = 0;
  dayNames.forEach((_, di) => {
    const total = dayRows.slice(1).reduce((sum, row) => sum + (Number(row[di + 1]) || 0), 0);
    dayGrandTotal += total;
    totalDayRow.push(total);
  });
  totalDayRow.push(dayGrandTotal);
  dayRows.push(totalDayRow);

  const wsDays = XLSX.utils.aoa_to_sheet(dayRows);
  wsDays["!cols"] = [{ wch: 30 }, ...dayNames.map(() => ({ wch: 12 })), { wch: 10, hidden: true }];
  XLSX.utils.book_append_sheet(wb, wsDays, "Audiência por Dia");

  // Download
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ranking_audiencia_natal_rn_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
