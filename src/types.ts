import type { ComponentType } from "react";

export type BenchmarkRow = {
  id: number;
  account: string;
  owner: string;
  region: string;
  segment: string;
  status: string;
  revenue: number;
  score: number;
  [key: string]: string | number;
};

export type AdapterProps = {
  rows: BenchmarkRow[];
  onReady: (details: ReadyDetails) => void;
};

export type ReadyDetails = {
  mountedCellSelector: string;
  scrollSelector: string;
  horizontalScrollSelector?: string;
};

export type AdapterModule = {
  default: ComponentType<AdapterProps>;
};

export type GridDefinition = {
  id: string;
  name: string;
  packageName: string;
  license: string;
  importer: () => Promise<AdapterModule>;
};
