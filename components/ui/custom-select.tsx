"use client";

// Aligned with estude-frontend/components/ui; bundled locally for this independent app.
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, LoaderCircle, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { normalizeSearchKeyword } from "@/lib/search-keyword";

export interface CustomSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface CustomSelectProps {
  value: string;
  options: CustomSelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
  placement?: "top" | "bottom";
  disabled?: boolean;
  ariaLabel?: string;
  showSelectedIndicator?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  onSearchChange?: (search: string) => void;
  isSearching?: boolean;
  id?: string;
  triggerRef?: Ref<HTMLButtonElement>;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  invalid?: boolean;
}

export function CustomSelect({
  value,
  options,
  onValueChange,
  placeholder = "Chọn giá trị",
  label,
  className,
  buttonClassName,
  menuClassName,
  optionClassName,
  placement = "bottom",
  disabled = false,
  ariaLabel,
  showSelectedIndicator = true,
  searchable = false,
  searchPlaceholder = "Tìm kiếm...",
  emptyMessage = "Không tìm thấy kết quả",
  onSearchChange,
  isSearching = false,
  id,
  triggerRef,
  ariaLabelledBy,
  ariaDescribedBy,
  invalid,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>();
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const labelId = useId();
  const menuId = useId();
  const selectedOption = options.find((option) => option.value === value);
  const normalizedSearch = normalizeSearchKeyword(search);
  const usesApiSearch = searchable && Boolean(onSearchChange);
  const filteredOptions =
    searchable && !usesApiSearch && normalizedSearch
      ? options.filter((option) =>
          normalizeSearchKeyword(option.label, option.value).includes(
            normalizedSearch,
          ),
        )
      : options;

  function clearPendingSearch() {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = null;
  }

  function handleSearchChange(nextSearch: string) {
    setSearch(nextSearch);
    if (!onSearchChange) return;
    clearPendingSearch();
    searchTimerRef.current = setTimeout(() => onSearchChange(nextSearch), 300);
  }

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        !containerRef.current?.contains(event.target as Node) &&
        !menuRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
        setSearch("");
        clearPendingSearch();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setSearch("");
        clearPendingSearch();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      clearPendingSearch();
    };
  }, []);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !menuRef.current) return;
    let frame = 0;
    function updatePosition() {
      const trigger = buttonRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;
      const rect = trigger.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const margin = 8;
      const below = Math.max(
        0,
        viewportTop + viewportHeight - rect.bottom - margin * 2,
      );
      const above = Math.max(0, rect.top - viewportTop - margin * 2);
      const desiredHeight = Math.min(256, menu.scrollHeight);
      const showAbove =
        placement === "top"
          ? above >= desiredHeight || above > below
          : below < desiredHeight && above > below;
      const maxHeight = Math.min(256, showAbove ? above : below);
      const width = Math.min(rect.width, viewportWidth - margin * 2);
      setMenuStyle({
        position: "fixed",
        width,
        left: Math.max(
          viewportLeft + margin,
          Math.min(rect.left, viewportLeft + viewportWidth - width - margin),
        ),
        top: showAbove ? undefined : rect.bottom + margin,
        bottom: showAbove ? window.innerHeight - rect.top + margin : undefined,
        maxHeight,
        zIndex: 1000,
      });
    }
    function schedulePosition() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updatePosition);
    }
    updatePosition();
    const observer = new ResizeObserver(schedulePosition);
    observer.observe(buttonRef.current);
    observer.observe(menuRef.current);
    window.addEventListener("scroll", schedulePosition, true);
    window.addEventListener("resize", schedulePosition);
    window.visualViewport?.addEventListener("resize", schedulePosition);
    window.visualViewport?.addEventListener("scroll", schedulePosition);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedulePosition, true);
      window.removeEventListener("resize", schedulePosition);
      window.visualViewport?.removeEventListener("resize", schedulePosition);
      window.visualViewport?.removeEventListener("scroll", schedulePosition);
    };
  }, [open, placement]);

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          buttonRef.current?.focus();
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
          return;
        if (!open && !["ArrowDown", "ArrowUp"].includes(event.key)) return;
        event.preventDefault();
        setOpen(true);
        const key = event.key;
        requestAnimationFrame(() => {
          const items = Array.from(
            menuRef.current?.querySelectorAll<HTMLButtonElement>(
              '[role="option"]:not(:disabled)',
            ) ?? [],
          );
          const current = items.findIndex(
            (item) => item === document.activeElement,
          );
          const next =
            key === "Home"
              ? 0
              : key === "End"
                ? items.length - 1
                : key === "ArrowDown"
                  ? (current + 1) % items.length
                  : current < 0
                    ? items.length - 1
                    : (current - 1 + items.length) % items.length;
          items[next]?.focus();
        });
      }}
    >
      {label ? (
        <span
          id={labelId}
          className="mb-2 block text-sm font-bold text-slate-700"
        >
          {label}
        </span>
      ) : null}
      <button
        id={id}
        ref={(node) => {
          buttonRef.current = node;
          if (typeof triggerRef === "function") triggerRef(node);
          else if (triggerRef) triggerRef.current = node;
        }}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={label ? labelId : ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        data-invalid={invalid || undefined}
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          setSearch("");
          clearPendingSearch();
          if (nextOpen) onSearchChange?.("");
        }}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          open && "border-blue-400 ring-4 ring-blue-100",
          invalid && "border-rose-400",
          buttonClassName,
        )}
      >
        <span className={cn("truncate", !selectedOption && "text-slate-400")}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-slate-400 transition-transform",
            open && "rotate-180 text-blue-600",
          )}
        />
      </button>

      {open && typeof document !== "undefined" && document.body
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="listbox"
              aria-label={ariaLabel ?? label}
              aria-labelledby={label ? labelId : ariaLabelledBy}
              style={menuStyle ?? { position: "fixed", visibility: "hidden" }}
              onMouseDown={(event) => event.stopPropagation()}
              className={cn(
                "max-h-64 min-w-0 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/15",
                menuClassName,
              )}
            >
              {searchable ? (
                <div className="sticky top-0 z-10 bg-white p-1 pb-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={search}
                      autoFocus
                      onChange={(event) =>
                        handleSearchChange(event.target.value)
                      }
                      placeholder={searchPlaceholder}
                      aria-label={searchPlaceholder}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>
              ) : null}

              {isSearching ? (
                <p className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-slate-400">
                  <LoaderCircle className="size-4 animate-spin" /> Đang tìm
                  kiếm...
                </p>
              ) : null}

              {!isSearching && filteredOptions.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-slate-400">
                  {emptyMessage}
                </p>
              ) : null}

              {!isSearching
                ? filteredOptions.map((option) => {
                    const selected = option.value === value;
                    return (
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        disabled={option.disabled}
                        tabIndex={-1}
                        key={option.value}
                        onClick={() => {
                          onValueChange(option.value);
                          setOpen(false);
                          buttonRef.current?.focus();
                          setSearch("");
                          clearPendingSearch();
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-left text-sm transition",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          selected
                            ? "bg-blue-600 font-bold text-white"
                            : "text-slate-700 hover:bg-blue-50 hover:text-blue-700",
                          optionClassName,
                        )}
                      >
                        <span className="min-w-0 whitespace-normal break-words">
                          {option.label}
                        </span>
                        {selected && showSelectedIndicator ? (
                          <Check className="size-4 shrink-0" />
                        ) : null}
                      </button>
                    );
                  })
                : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
