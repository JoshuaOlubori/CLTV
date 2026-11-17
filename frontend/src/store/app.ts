import { create } from "zustand";
import type { Lang } from "@/lib/i18n";

export type View = "overview" | "transitions" | "subscribers";

interface AppState {
  lang: Lang;
  view: View;
  /** segment picked in the Overview explorer (index into meta.lists.segments) */
  pick: number;
  /** customer-list filters; values are the API's fixed English keys */
  segmentFilter: string[];
  tierFilter: string[];
  search: string;
  page: number;
  /** "Send to CMS" panel */
  sendOpen: boolean;
  /** customer drill-down (customer_id) */
  openCustomerId: string | null;

  setLang: (lang: Lang) => void;
  show: (view: View) => void;
  setPick: (pick: number) => void;
  toggleSegment: (name: string) => void;
  toggleTier: (name: string) => void;
  setSearch: (search: string) => void;
  setPage: (page: number) => void;
  clearFilters: () => void;
  /** "View these customers" on the Overview: filter the list and open it. */
  viewSegment: (name: string) => void;
  setSendOpen: (open: boolean) => void;
  setOpenCustomerId: (id: string | null) => void;
}

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

export const useApp = create<AppState>((set) => ({
  lang: "en",
  view: "overview",
  pick: 0,
  segmentFilter: [],
  tierFilter: [],
  search: "",
  page: 0,
  sendOpen: false,
  openCustomerId: null,

  setLang: (lang) => set({ lang }),
  show: (view) => {
    set({ view });
    window.scrollTo(0, 0);
  },
  setPick: (pick) => set({ pick }),
  toggleSegment: (name) => set((s) => ({ segmentFilter: toggle(s.segmentFilter, name), page: 0 })),
  toggleTier: (name) => set((s) => ({ tierFilter: toggle(s.tierFilter, name), page: 0 })),
  setSearch: (search) => set({ search, page: 0 }),
  setPage: (page) => set({ page }),
  clearFilters: () => set({ segmentFilter: [], tierFilter: [], search: "", page: 0 }),
  viewSegment: (name) => {
    set({ segmentFilter: [name], tierFilter: [], search: "", page: 0, view: "subscribers" });
    window.scrollTo(0, 0);
  },
  setSendOpen: (sendOpen) => set({ sendOpen }),
  setOpenCustomerId: (openCustomerId) => set({ openCustomerId }),
}));