import { create } from "zustand";

interface ShellState {
  compactMode: boolean;
  toggleCompactMode: () => void;
}

export const useShellStore = create<ShellState>((set) => ({
  compactMode: false,
  toggleCompactMode: () => set((state) => ({ compactMode: !state.compactMode })),
}));
