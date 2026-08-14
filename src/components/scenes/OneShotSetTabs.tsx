"use client";

import { Popover } from "@/components/ui/Popover";
import { RenameMenuItem } from "@/components/ui/RenameMenuItem";
import { Tooltip } from "@/components/ui/Tooltip";
import { KebabIcon, PlusIcon } from "@/components/ui/icons";
import type { OneShotSet } from "@/types/domain";

const MENU_ITEM_CLASS =
  "focus-ring flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-parchment-200 transition hover:bg-ink-700";

type OneShotSetTabsProps = {
  sets: OneShotSet[];
  activeSetId: string;
  onSelect: (setId: string) => void;
  onCreate: () => void;
  onRename: (setId: string, name: string) => void;
  onDelete: (setId: string) => void;
  creating: boolean;
};

/**
 * The pad grid shows one set at a time; this is how you get to the others.
 * Rename and delete belong to whichever set is showing, so they sit in a single
 * menu at the end of the row rather than one kebab per tab — twenty pads below
 * are enough small targets already.
 */
export function OneShotSetTabs({
  sets,
  activeSetId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  creating,
}: OneShotSetTabsProps) {
  const activeSet = sets.find((set) => set.id === activeSetId) ?? sets[0];
  if (!activeSet) return null;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <div
        role="tablist"
        aria-label="One-shot-set"
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
      >
        {sets.map((set) => {
          const active = set.id === activeSet.id;
          const filled = set.slots.filter((slot) => slot.audioFileId).length;
          return (
            <button
              key={set.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(set.id)}
              className={`focus-ring flex flex-none items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
                active
                  ? "bg-ink-700 font-medium text-parchment-100"
                  : "text-muted-foreground hover:text-parchment-200"
              }`}
            >
              {set.name}
              <span className="font-mono text-[11px] text-muted-foreground">{filled}</span>
            </button>
          );
        })}
      </div>

      <Tooltip label="Nytt set" align="end" className="flex-none">
        <button
          type="button"
          onClick={onCreate}
          disabled={creating}
          aria-label="Nytt one-shot-set"
          className="focus-ring flex h-8 w-8 flex-none items-center justify-center rounded-full text-muted-foreground transition hover:bg-ink-700 hover:text-ember-300 disabled:opacity-40"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </Tooltip>

      <Popover
        panelClassName="w-52"
        trigger={({ open, toggle }) => (
          <Tooltip label="Alternativ för setet" align="end">
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-label={`Alternativ för ${activeSet.name}`}
              className="focus-ring flex h-8 w-8 flex-none items-center justify-center rounded-full text-muted-foreground transition hover:bg-ink-700 hover:text-parchment-100"
            >
              <KebabIcon className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
      >
        {({ close }) => (
          <div className="flex flex-col gap-2">
            <RenameMenuItem
              value={activeSet.name}
              fallback={activeSet.name}
              // A set has no underlying filename to fall back to, so an empty
              // field means "leave it alone" rather than "clear the name".
              onCommit={(name) => {
                if (name && name !== activeSet.name) onRename(activeSet.id, name);
              }}
              onDone={close}
              itemClassName={MENU_ITEM_CLASS}
              label="Byt namn på setet"
            />
            <button
              type="button"
              onClick={() => {
                onDelete(activeSet.id);
                close();
              }}
              disabled={sets.length <= 1}
              className={`${MENU_ITEM_CLASS} text-wine-400 hover:text-wine-300 disabled:opacity-40`}
            >
              Radera setet
            </button>
          </div>
        )}
      </Popover>
    </div>
  );
}
