import type { BenchmarkRow } from "./types";

export const ROW_COUNT = 50_000;
export const COLUMN_COUNT = 20;
export const GRID_WIDTH = 1200;
export const GRID_HEIGHT = 600;
export const ROW_HEIGHT = 36;

const owners = ["Maya", "Theo", "Lena", "Iris", "Noah", "Amir", "June", "Sam"];
const regions = ["NA", "EMEA", "APAC", "LATAM"];
const segments = ["Enterprise", "Mid-market", "Growth", "Startup"];
const statuses = ["Live", "Review", "Risk", "Planned"];

function hash(index: number, salt: number): number {
  let value = (index + 1) * 2654435761 + salt * 1013904223;
  value ^= value >>> 16;
  value = Math.imul(value, 2246822507);
  value ^= value >>> 13;
  return value >>> 0;
}

export function createRows(count = ROW_COUNT): BenchmarkRow[] {
  return Array.from({ length: count }, (_, index) => {
    const row: BenchmarkRow = {
      id: index + 1,
      account: `Account ${String(index + 1).padStart(5, "0")}`,
      owner: owners[hash(index, 1) % owners.length],
      region: regions[hash(index, 2) % regions.length],
      segment: segments[hash(index, 3) % segments.length],
      status: statuses[hash(index, 4) % statuses.length],
      revenue: 25_000 + (hash(index, 5) % 975_000),
      score: 50 + (hash(index, 6) % 51)
    };
    for (let column = 8; column < COLUMN_COUNT; column += 1) {
      row[`metric${column - 7}`] = hash(index, column) % 10_000;
    }
    return row;
  });
}

export const fieldNames = [
  "id", "account", "owner", "region", "segment", "status", "revenue", "score",
  ...Array.from({ length: 12 }, (_, index) => `metric${index + 1}`)
];

export function titleFor(field: string): string {
  if (field.startsWith("metric")) return `Metric ${field.slice(6)}`;
  return field.charAt(0).toUpperCase() + field.slice(1);
}
