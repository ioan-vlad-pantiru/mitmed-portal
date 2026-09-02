"use client";

import { useState, type ReactNode } from "react";

export type TabItem = { key: string; label: string; content: ReactNode };

/** Tabs simplu, hand-rolled — stare locală, fără dependință nouă (spre
 * deosebire de Dialog, aici nu e nevoie de focus-trap/accesibilitate complexă). */
export function Tabs({ items, defaultKey }: { items: TabItem[]; defaultKey?: string }) {
  const [active, setActive] = useState(defaultKey ?? items[0]?.key);
  const activeItem = items.find((i) => i.key === active) ?? items[0];

  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-zinc-100">
        {items.map((item) => (
          <button
            key={item.key}
            role="tab"
            type="button"
            aria-selected={item.key === active}
            onClick={() => setActive(item.key)}
            className={`relative px-3 py-2 text-sm font-medium transition-colors ${
              item.key === active ? "text-[var(--mitmed-teal-deep)]" : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {item.label}
            {item.key === active && (
              <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-[var(--mitmed-teal)]" />
            )}
          </button>
        ))}
      </div>
      <div className="pt-4">{activeItem?.content}</div>
    </div>
  );
}
