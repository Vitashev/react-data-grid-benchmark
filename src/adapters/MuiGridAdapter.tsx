import { useMemo, useState } from "react";
import { DataGrid, type GridColDef, type GridRowsProp } from "@mui/x-data-grid";
import { fieldNames, GRID_HEIGHT, GRID_WIDTH, ROW_HEIGHT, titleFor } from "../fixture";
import type { AdapterProps } from "../types";
import { useReady } from "../useReady";

export default function MuiGridAdapter({ rows: sourceRows, onReady }: AdapterProps) {
  const [rows, setRows] = useState<GridRowsProp>(sourceRows);
  const columns = useMemo<GridColDef[]>(() => fieldNames.map((field) => ({
    field,
    headerName: titleFor(field),
    width: 140,
    editable: field === "account" || field === "owner",
    sortable: true,
    filterable: true,
    type: typeof sourceRows[0][field] === "number" ? "number" : "string"
  })), [sourceRows]);
  useReady(onReady, { mountedCellSelector: "[role=gridcell]", scrollSelector: ".MuiDataGrid-virtualScroller" });
  return <div style={{ width: GRID_WIDTH, height: GRID_HEIGHT }}>
    <DataGrid
      rows={rows}
      columns={columns}
      rowHeight={ROW_HEIGHT}
      columnHeaderHeight={ROW_HEIGHT}
      disableRowSelectionOnClick
      processRowUpdate={(nextRow) => {
        setRows((current) => current.map((row) => row.id === nextRow.id ? nextRow : row));
        return nextRow;
      }}
      showToolbar
    />
  </div>;
}
