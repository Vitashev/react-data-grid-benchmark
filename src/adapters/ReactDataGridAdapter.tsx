import { useMemo, useState } from "react";
import { DataGrid, type Column, type RowsChangeData } from "react-data-grid";
import "react-data-grid/lib/styles.css";
import { fieldNames, GRID_HEIGHT, GRID_WIDTH, ROW_HEIGHT, titleFor } from "../fixture";
import type { AdapterProps, BenchmarkRow } from "../types";
import { useReady } from "../useReady";

export default function ReactDataGridAdapter({ rows: sourceRows, onReady }: AdapterProps) {
  const [rows, setRows] = useState(sourceRows);
  const columns = useMemo<Column<BenchmarkRow>[]>(() => fieldNames.map((key) => ({
    key,
    name: titleFor(key),
    width: 140,
    minWidth: 140,
    resizable: true,
    sortable: true,
    renderEditCell: key === "account" || key === "owner" ? ({ row, column, onRowChange }) => (
      <input autoFocus value={String(row[column.key])} onChange={(event) => onRowChange({ ...row, [column.key]: event.target.value })} />
    ) : undefined
  })), []);
  useReady(onReady, { mountedCellSelector: "[role=gridcell]", scrollSelector: ".rdg" });
  const onRowsChange = (nextRows: BenchmarkRow[], _data: RowsChangeData<BenchmarkRow>) => setRows(nextRows);
  return <DataGrid
    columns={columns}
    rows={rows}
    onRowsChange={onRowsChange}
    rowKeyGetter={(row: BenchmarkRow) => row.id}
    rowHeight={ROW_HEIGHT}
    headerRowHeight={ROW_HEIGHT}
    style={{ width: GRID_WIDTH, height: GRID_HEIGHT }}
  />;
}
