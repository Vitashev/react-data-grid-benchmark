import type { GridDefinition } from "./types";

export const grids: GridDefinition[] = [
  { id: "ace-grid", name: "Ace Grid Core", packageName: "@ace-grid/core", license: "MIT", datasetMode: "continuous-virtual", importer: () => import("./adapters/AceGridAdapter") },
  { id: "ag-grid", name: "AG Grid Community", packageName: "ag-grid-react", license: "MIT", datasetMode: "continuous-virtual", importer: () => import("./adapters/AgGridAdapter") },
  { id: "mui", name: "MUI X Data Grid Community", packageName: "@mui/x-data-grid", license: "MIT community tier", datasetMode: "forced-pagination", importer: () => import("./adapters/MuiGridAdapter") },
  { id: "tanstack", name: "TanStack Table + Virtual", packageName: "@tanstack/react-table", license: "MIT", datasetMode: "continuous-virtual", importer: () => import("./adapters/TanStackAdapter") },
  { id: "handsontable", name: "Handsontable", packageName: "handsontable", license: "Non-commercial/evaluation key", datasetMode: "continuous-virtual", importer: () => import("./adapters/HandsontableAdapter") },
  { id: "react-data-grid", name: "React Data Grid", packageName: "react-data-grid", license: "MIT", datasetMode: "continuous-virtual", importer: () => import("./adapters/ReactDataGridAdapter") }
];
