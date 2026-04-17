"use client";

/**
 * RegionSelector — compact flag + currency trigger with a 4-region dropdown.
 *
 * Renders inline in the SiteHeader utility-icons strip.
 * Uses CSS custom properties from globals.css — no Tailwind classes.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useRegion } from "@/store/region-context";
import { REGIONS, type RegionCode } from "@/lib/regions";

export function RegionSelector() {
  const { regionCode, setRegionCode } = useRegion();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // ── Close on outside click ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const handleSelect = useCallback(
    (code: RegionCode) => {
      setRegionCode(code);
      setOpen(false);
    },
    [setRegionCode]
  );

  const activeRegion = REGIONS.find((r) => r.code === regionCode) ?? REGIONS[1];

  // Render a stable SSR placeholder until hydration is complete
  if (!mounted) {
    return (
      <div style={{ width: 72, height: 32, display: "inline-flex", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 500, fontFamily: "var(--font-sans)",
          color: "var(--color-ink-mid)", padding: "6px 8px" }}>
          🇺🇸 USD
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
    >
      {/* ── Trigger button ────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Region: ${activeRegion.label}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          backgroundColor: open ? "var(--color-surface)" : "transparent",
          border: "none",
          cursor: "pointer",
          padding: "6px 8px",
          borderRadius: 6,
          color: open ? "var(--color-ink)" : "var(--color-ink-mid)",
          fontSize: 12,
          fontWeight: 500,
          fontFamily: "var(--font-sans)",
          letterSpacing: "0.01em",
          transition: "color 0.15s, background-color 0.15s",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          if (!open) {
            (e.currentTarget as HTMLElement).style.color = "var(--color-ink)";
            (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-surface)";
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            (e.currentTarget as HTMLElement).style.color = "var(--color-ink-mid)";
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
          }
        }}
      >
        <span suppressHydrationWarning style={{ fontSize: 15, lineHeight: 1 }}>{activeRegion.flag}</span>
        <span suppressHydrationWarning>{activeRegion.currency}</span>
        {/* Chevron */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden="true"
          style={{
            transition: "transform 0.18s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            color: "currentColor",
          }}
        >
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* ── Dropdown ──────────────────────────────────────────────────────── */}
      {open && (
        <div
          role="listbox"
          aria-label="Select region"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 200,
            backgroundColor: "var(--color-canvas)",
            border: "1px solid var(--color-border-light)",
            borderRadius: 8,
            boxShadow: "var(--shadow-float)",
            overflow: "hidden",
            zIndex: 200,
            animation: "fade-up 0.18s cubic-bezier(0.22,1,0.36,1) forwards",
          }}
        >
          {/* Header label */}
          <div
            style={{
              padding: "10px 14px 8px",
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase" as const,
              letterSpacing: "0.12em",
              color: "var(--color-ink-light)",
              borderBottom: "1px solid var(--color-border-light)",
            }}
          >
            Ship to
          </div>

          {REGIONS.map((region) => {
            const isActive = region.code === regionCode;
            return (
              <button
                key={region.code}
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelect(region.code)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "10px 14px",
                  background: isActive ? "var(--color-surface)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left" as const,
                  fontFamily: "var(--font-sans)",
                  transition: "background-color 0.12s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "var(--color-surface-mid)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                  }
                }}
              >
                {/* Flag */}
                <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>
                  {region.flag}
                </span>

                {/* Label + currency */}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? "var(--color-ink)" : "var(--color-ink-mid)",
                      lineHeight: 1.3,
                    }}
                  >
                    {region.label}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 11,
                      color: "var(--color-ink-light)",
                      marginTop: 1,
                    }}
                  >
                    {region.currency} · {region.symbol}
                  </span>
                </span>

                {/* Active tick */}
                {isActive && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    aria-hidden="true"
                    style={{ flexShrink: 0, color: "var(--color-pink)" }}
                  >
                    <path
                      d="M2.5 7L5.5 10L11.5 4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
