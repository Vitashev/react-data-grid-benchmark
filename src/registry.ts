import type { GridDefinition } from "./types";

export const grids: GridDefinition[] = [
  { id: "ace-grid", name: "Ace Grid Core", packageName: "@ace-grid/core", license: "MIT", importer: () => import("./adapters/AceGridAdapter") },
  { id: "ag-grid", name: "AG Grid Community", packageName: "ag-grid-react", license: "MIT", importer: () => import("./adapters/AgGridAdapter") },
  { id: "mui", name: "MUI X Data Grid", packageName: "@mui/x-data-grid", license: "MIT community tier", importer: () => import("./adapters/MuiGridAdapter") },
  { id: "tanstack", name: "TanStack Table + Virtual", packageName: "@tanstack/react-table", license: "MIT", importer: () => import("./adapters/TanStackAdapter") },
  { id: "handsontable", name: "Handsontable", packageName: "handsontable", license: "Non-commercial/evaluation key", importer: () => import("./adapters/HandsontableAdapter") },
  { id: "react-data-grid", name: "React Data Grid", packageName: "react-data-grid", license: "MIT", importer: () => import("./adapters/ReactDataGridAdapter") }
];
