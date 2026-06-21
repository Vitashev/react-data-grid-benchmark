import { useMemo, useState } from "react";
import { Grid, type CellValue, type GridColumnDef, type GridProps, type GridRow } from "@ace-grid/core";
import { fieldNames, GRID_HEIGHT, GRID_WIDTH, ROW_HEIGHT, titleFor } from "../fixture";
import type { AdapterProps, BenchmarkRow } from "../types";
import { useReady } from "../useReady";

export default function AceGridAdapter({ rows: sourceRows, onReady }: AdapterProps) {
  const [rows, setRows] = useState<GridRow[]>(() => sourceRows.map(toGridRow));
  const columns = useMemo<GridColumnDef[]>(() => fieldNames.map((key) => ({
    key,
    title: titleFor(key),
    width: 140,
    editable: key === "account" || key === "owner",
    sortable: true,
    filterable: true,
    type: typeof sourceRows[0][key] === "number" ? "number" : "text"
  })), [sourceRows]);
  useReady(onReady, { mountedCellSelector: "[role=gridcell]", scrollSelector: ".ace-grid" });

  const gridProps = {
    data: { rows, columns },
    layout: { width: GRID_WIDTH, height: GRID_HEIGHT, rowHeight: ROW_HEIGHT },
    columns: { columnWidths: Object.fromEntries(fieldNames.map((field) => [field, 140])) },
    virtual: { enableVirtualization: true, enableHorizontalVirtualization: true, rowBufferPx: 72, columnBufferPx: 140 },
    edit: {
      isCellEditing: true,
      onCellChange: (rowId: string | number, columnKey: string, value: CellValue) => setRows((current) => current.map((row) => row.id === rowId ? { ...row, data: { ...row.data, [columnKey]: value } } : row))
    },
    sorting: { sortMode: "client" },
    filter: { filterMode: "client", enableFloatingFilters: true },
    selection: { enableCellSelection: true, isRowSelection: false, isColSelection: false },
    pinning: { isRowPinning: false, isColPinning: false },
    reorder: { isRowReorder: false, isColReorder: false },
    resize: { enableRowResize: false, enableColumnResize: false },
    spanning: { enableCellSpanning: false }
  } as unknown as GridProps;
  return <Grid {...gridProps} />;
}

function toGridRow(row: BenchmarkRow): GridRow {
  return {
    id: row.id,
    data: Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, { value }])
    )
  };
}
