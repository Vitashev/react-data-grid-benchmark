import { useMemo, useRef, useState } from "react";
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { fieldNames, GRID_HEIGHT, GRID_WIDTH, ROW_HEIGHT, titleFor } from "../fixture";
import type { AdapterProps, BenchmarkRow } from "../types";
import { useReady } from "../useReady";

const helper = createColumnHelper<BenchmarkRow>();

export default function TanStackAdapter({ rows: sourceRows, onReady }: AdapterProps) {
  const [rows, setRows] = useState(sourceRows);
  const scrollRef = useRef<HTMLDivElement>(null);
  const columns = useMemo(() => fieldNames.map((field) => helper.accessor((row) => row[field], {
    id: field,
    header: titleFor(field),
    size: 140,
    cell: ({ row, getValue }) => field === "account" || field === "owner" ? (
      <input value={String(getValue())} onChange={(event) => setRows((current) => current.map((item) => item.id === row.original.id ? { ...item, [field]: event.target.value } : item))} />
    ) : String(getValue())
  })), []);
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel() });
  const visibleRows = table.getRowModel().rows;
  const visibleColumns = table.getVisibleLeafColumns();
  const rowVirtualizer = useVirtualizer({ count: visibleRows.length, getScrollElement: () => scrollRef.current, estimateSize: () => ROW_HEIGHT, overscan: 10 });
  const columnVirtualizer = useVirtualizer({ horizontal: true, count: visibleColumns.length, getScrollElement: () => scrollRef.current, estimateSize: () => 140, overscan: 2 });
  useReady(onReady, { mountedCellSelector: "[role=gridcell]", scrollSelector: ".tanstack-grid" });

  const virtualColumns = columnVirtualizer.getVirtualItems();
  return <div ref={scrollRef} className="tanstack-grid" style={{ width: GRID_WIDTH, height: GRID_HEIGHT }}>
    <div className="tanstack-spacer" style={{ height: rowVirtualizer.getTotalSize() + ROW_HEIGHT }}>
      <div className="tanstack-header" role="row" style={{ width: columnVirtualizer.getTotalSize() }}>
        {virtualColumns.map((virtualColumn) => {
          const header = table.getHeaderGroups()[0].headers[virtualColumn.index];
          return <div role="columnheader" className="tanstack-cell" key={header.id} style={{ position: "absolute", transform: `translateX(${virtualColumn.start}px)` }} onClick={header.column.getToggleSortingHandler()}>
            {flexRender(header.column.columnDef.header, header.getContext())}
          </div>;
        })}
      </div>
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const row = visibleRows[virtualRow.index];
        const cells = row.getVisibleCells();
        return <div role="row" className="tanstack-row" key={row.id} style={{ top: ROW_HEIGHT, height: ROW_HEIGHT, transform: `translateY(${virtualRow.start}px)`, width: columnVirtualizer.getTotalSize() }}>
          {virtualColumns.map((virtualColumn) => {
            const cell = cells[virtualColumn.index];
            return <div role="gridcell" className="tanstack-cell" key={cell.id} style={{ position: "absolute", transform: `translateX(${virtualColumn.start}px)` }}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </div>;
          })}
        </div>;
      })}
    </div>
  </div>;
}
