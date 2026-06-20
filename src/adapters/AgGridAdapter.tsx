import { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type ColDef } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { fieldNames, GRID_HEIGHT, GRID_WIDTH, ROW_HEIGHT, titleFor } from "../fixture";
import type { AdapterProps, BenchmarkRow } from "../types";
import { useReady } from "../useReady";

ModuleRegistry.registerModules([AllCommunityModule]);

export default function AgGridAdapter({ rows: sourceRows, onReady }: AdapterProps) {
  const [rows] = useState(sourceRows);
  const columns = useMemo<ColDef<BenchmarkRow>[]>(() => fieldNames.map((field) => ({
    field,
    headerName: titleFor(field),
    width: 140,
    editable: field === "account" || field === "owner",
    sortable: true,
    filter: true
  })), []);
  useReady(onReady, { mountedCellSelector: ".ag-cell", scrollSelector: ".ag-body-viewport", horizontalScrollSelector: ".ag-body-horizontal-scroll-viewport" });
  return <div className="ag-theme-quartz" style={{ width: GRID_WIDTH, height: GRID_HEIGHT }}>
    <AgGridReact rowData={rows} columnDefs={columns} rowHeight={ROW_HEIGHT} headerHeight={ROW_HEIGHT} animateRows={false} suppressColumnVirtualisation={false} />
  </div>;
}
