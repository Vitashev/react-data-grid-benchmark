import { useMemo, useState } from "react";
import { HotTable } from "@handsontable/react-wrapper";
import { registerAllModules } from "handsontable/registry";
import "handsontable/styles/handsontable.min.css";
import "handsontable/styles/ht-theme-main.min.css";
import { fieldNames, GRID_HEIGHT, GRID_WIDTH, ROW_HEIGHT, titleFor } from "../fixture";
import type { AdapterProps } from "../types";
import { useReady } from "../useReady";

registerAllModules();

export default function HandsontableAdapter({ rows, onReady }: AdapterProps) {
  const [data] = useState(() => rows.map((row) => fieldNames.map((field) => row[field])));
  const columns = useMemo(() => fieldNames.map((field) => ({ data: fieldNames.indexOf(field), readOnly: field !== "account" && field !== "owner" })), []);
  useReady(onReady, { mountedCellSelector: "td", scrollSelector: ".wtHolder" });
  return <HotTable
    data={data}
    columns={columns}
    colHeaders={fieldNames.map(titleFor)}
    rowHeaders
    width={GRID_WIDTH}
    height={GRID_HEIGHT}
    rowHeights={ROW_HEIGHT}
    colWidths={140}
    filters
    dropdownMenu
    columnSorting
    licenseKey="non-commercial-and-evaluation"
    themeName="ht-theme-main"
  />;
}
