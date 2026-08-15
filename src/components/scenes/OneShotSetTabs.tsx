"use client";

import { useEffect, useRef, useState } from "react";
import { Popover } from "@/components/ui/Popover";
import { RenameMenuItem } from "@/components/ui/RenameMenuItem";
import { Tooltip } from "@/components/ui/Tooltip";
import { ChevronDownIcon, KebabIcon, PlusIcon } from "@/components/ui/icons";
import type { OneShotSet } from "@/types/domain";

const MENU_ITEM_CLASS =
  "focus-ring flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-parchment-200 transition hover:bg-ink-700";

/** Stands in for "no group" as a filter key — a set need not be in one. */
export const UNGROUPED = "__utan_grupp__";
const UNGROUPED_LABEL = "Utan grupp";
const ALL_GROUPS_LABEL = "Alla grupper";

export function groupKeyOf(set: OneShotSet): string {
  return set.groupName ?? UNGROUPED;
}

type OneShotSetTabsProps = {
  sets: OneShotSet[];
  /** Null only before the first set exists — the row is then just the "+". */
  activeSetId: string | null;
  /** Which group the tabs are narrowed to; null shows every set at once. */
  groupFilter: string | null;
  onSelectGroup: (groupKey: string | null) => void;
  onSelect: (setId: string) => void;
  onCreate: () => void;
  onRename: (setId: string, name: string) => void;
  onGroupChange: (setId: string, groupName: string | null) => void;
  onDelete: (setId: string) => void;
  creating: boolean;
};

/**
 * The pad grid shows one set at a time, and every set there is can be shown in
 * any scene; this is how you get to the others. Once there are more sets than
 * fit a row they are filed under free-form groups — "Strid", "Miljö" — and the
 * switcher at the left decides which group the tabs belong to, the same way the
 * campaign switcher decides which scenes the tabs above hold.
 *
 * Rename, group and delete belong to whichever set is showing, so they sit in a
 * single menu at the end of the row rather than one kebab per tab — twenty pads
 * below are enough small targets already.
 */
export function OneShotSetTabs({
  sets,
  activeSetId,
  groupFilter,
  onSelectGroup,
  onSelect,
  onCreate,
  onRename,
  onGroupChange,
  onDelete,
  creating,
}: OneShotSetTabsProps) {
  const activeSet = sets.find((set) => set.id === activeSetId) ?? sets[0] ?? null;

  // In tab order rather than alphabetical, so the switcher lists groups in the
  // order their sets appear — and the group you use most tends to sort first.
  const groupKeys: string[] = [];
  for (const set of sets) {
    const key = groupKeyOf(set);
    if (!groupKeys.includes(key)) groupKeys.push(key);
  }
  const namedGroups = groupKeys.filter((key) => key !== UNGROUPED);

  const visibleSets =
    groupFilter === null ? sets : sets.filter((set) => groupKeyOf(set) === groupFilter);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      {/* A switcher appears only once a set has been filed somewhere: with every
          set ungrouped it would offer a choice between "all" and "the same
          all". */}
      {namedGroups.length > 0 && (
        <GroupSwitcher
          groupKeys={groupKeys}
          activeGroup={groupFilter}
          onSelect={onSelectGroup}
        />
      )}

      <div
        role="tablist"
        aria-label="One-shot-set"
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
      >
        {visibleSets.map((set) => {
          const active = set.id === activeSet?.id;
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

      {activeSet && (
        <Popover
          panelClassName="w-56"
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
              <GroupMenuItem
                set={activeSet}
                groupNames={namedGroups}
                onCommit={(groupName) => onGroupChange(activeSet.id, groupName)}
                onDone={close}
              />
              {/* No last-set rule to enforce: sets are shared, and deleting the
                  final one leaves the grid offering to make the next one. */}
              <button
                type="button"
                onClick={() => {
                  onDelete(activeSet.id);
                  close();
                }}
                className={`${MENU_ITEM_CLASS} text-wine-400 hover:text-wine-300`}
              >
                Radera setet
              </button>
            </div>
          )}
        </Popover>
      )}
    </div>
  );
}

/**
 * Picks which group the tabs belong to. Modelled on the campaign switcher above
 * the scene tabs, and for the same reason: it decides what the row next to it
 * contains.
 */
function GroupSwitcher({
  groupKeys,
  activeGroup,
  onSelect,
}: {
  groupKeys: string[];
  activeGroup: string | null;
  onSelect: (groupKey: string | null) => void;
}) {
  const label = activeGroup === null ? ALL_GROUPS_LABEL : groupLabel(activeGroup);

  return (
    <Popover
      align="left"
      className="flex-none"
      panelClassName="w-52 max-w-[calc(100vw-2rem)]"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={`Grupp: ${label}`}
          className={`focus-ring flex max-w-[10rem] items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
            open
              ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
              : "border-border-strong text-parchment-200 hover:border-ember-400/40 hover:text-ember-300"
          }`}
        >
          <span className="truncate">{label}</span>
          <ChevronDownIcon className="h-4 w-4 flex-none" />
        </button>
      )}
    >
      {({ close }) => (
        <div className="flex flex-col">
          <p className="px-2 pb-1 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
            Grupp
          </p>
          <GroupOption
            label={ALL_GROUPS_LABEL}
            active={activeGroup === null}
            onSelect={() => {
              onSelect(null);
              close();
            }}
          />
          {groupKeys.map((key) => (
            <GroupOption
              key={key}
              label={groupLabel(key)}
              active={key === activeGroup}
              onSelect={() => {
                onSelect(key);
                close();
              }}
            />
          ))}
        </div>
      )}
    </Popover>
  );
}

function groupLabel(groupKey: string): string {
  return groupKey === UNGROUPED ? UNGROUPED_LABEL : groupKey;
}

function GroupOption({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={`focus-ring truncate rounded-md px-2 py-2 text-left text-sm transition ${
        active
          ? "bg-ember-400/10 font-medium text-ember-300"
          : "text-parchment-100 hover:bg-surface hover:text-ember-300"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Files the showing set under a group. A plain text field with the groups that
 * already exist offered as completions, so filing a second set under "Strid"
 * doesn't depend on spelling it the same way twice.
 */
function GroupMenuItem({
  set,
  groupNames,
  onCommit,
  onDone,
}: {
  set: OneShotSet;
  groupNames: string[];
  onCommit: (groupName: string | null) => void;
  onDone: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className={MENU_ITEM_CLASS}>
        <PlusIcon className="h-3.5 w-3.5 flex-none" />
        {set.groupName ? "Byt grupp" : "Sätt grupp"}
      </button>
    );
  }

  return <GroupField set={set} groupNames={groupNames} onCommit={onCommit} onDone={onDone} />;
}

/**
 * Commits when it unmounts as well as on blur, for the same reason the rename
 * field does: the menu closes on click-outside, which tears the input down
 * without ever firing blur — and a group someone just typed shouldn't disappear
 * with the panel.
 */
function GroupField({
  set,
  groupNames,
  onCommit,
  onDone,
}: {
  set: OneShotSet;
  groupNames: string[];
  onCommit: (groupName: string | null) => void;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(set.groupName ?? "");

  const commitRef = useRef<() => void>(() => {});
  useEffect(() => {
    commitRef.current = () => {
      const trimmed = draft.trim();
      if (trimmed === (set.groupName ?? "")) return;
      onCommit(trimmed === "" ? null : trimmed);
    };
  });

  useEffect(() => () => commitRef.current(), []);

  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
        Grupp
      </span>
      <input
        type="text"
        autoFocus
        value={draft}
        list="lyriad-oneshot-set-groups"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commitRef.current()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onDone();
          }
          if (e.key === "Escape" && draft !== (set.groupName ?? "")) {
            // Swallowed, or the panel's own Escape listener closes it and the
            // unmount commit persists the draft being discarded.
            e.stopPropagation();
            setDraft(set.groupName ?? "");
          }
        }}
        placeholder={UNGROUPED_LABEL}
        className="focus-ring w-full rounded-md border border-border-strong bg-background px-2 py-1 text-xs text-parchment-100 placeholder:text-muted-foreground focus:border-ember-400"
      />
      <datalist id="lyriad-oneshot-set-groups">
        {groupNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </label>
  );
}
