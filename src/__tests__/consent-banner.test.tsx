/**
 * DIMENSION 2 — Integration Tests: ConsentBanner component
 *
 * Verifies the GDPR/POPIA consent gate UI integrates correctly with:
 *   - consent.ts hasConsent() / giveConsent() lifecycle
 *   - AnimatePresence visibility gating (after hydration)
 *   - Accessibility attributes (role, aria-modal, aria-labelledby)
 *   - Accept / Decline action wiring
 *   - onConsent callback invocation
 *
 * Note: framer-motion AnimatePresence relies on a useEffect for initial
 * visibility — we flush effects via waitFor / act.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConsentBanner, useConsent } from "@/components/ConsentBanner";
import { giveConsent, hasConsent } from "@/lib/consent";
import { renderHook, act } from "@testing-library/react";

// Mock next/navigation — not available in jsdom test environment
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// ─── Visibility gating ────────────────────────────────────────────────────────

describe("ConsentBanner — visibility", () => {
  it("renders the dialog when no consent has been given", async () => {
    render(<ConsentBanner />);
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("does NOT render the dialog when consent already given", async () => {
    giveConsent();
    render(<ConsentBanner />);
    // Short wait to ensure useEffect ran
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});

// ─── Accessibility ────────────────────────────────────────────────────────────

describe("ConsentBanner — accessibility (WCAG 2.1 / GDPR Art. 7)", () => {
  it("dialog has role='dialog' and aria-modal='true'", async () => {
    render(<ConsentBanner />);
    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });
  });

  it("dialog is labelled by consent-title element", async () => {
    render(<ConsentBanner />);
    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-labelledby", "consent-title");
    });
    expect(screen.getByText("Before you begin")).toBeInTheDocument();
  });

  it("contains both camera and storage disclosure text", async () => {
    render(<ConsentBanner />);
    await waitFor(() => {
      expect(screen.getByText(/Camera — processed on your device only/i)).toBeInTheDocument();
      expect(screen.getByText(/Cart — stored locally for 30 days/i)).toBeInTheDocument();
    });
  });

  it("shows GDPR regulation references", async () => {
    render(<ConsentBanner />);
    await waitFor(() => {
      expect(screen.getByText(/GDPR Art\. 6\(1\)\(a\)/)).toBeInTheDocument();
      expect(screen.getByText(/POPIA Section 11\(1\)\(a\)/)).toBeInTheDocument();
    });
  });

  it("Accept button has accessible label", async () => {
    render(<ConsentBanner />);
    await waitFor(() => {
      expect(screen.getByText(/I Accept — Continue/i)).toBeInTheDocument();
    });
  });

  it("Decline link is present", async () => {
    render(<ConsentBanner />);
    await waitFor(() => {
      expect(screen.getByText(/Decline/i)).toBeInTheDocument();
    });
  });
});

// ─── Accept flow ──────────────────────────────────────────────────────────────

describe("ConsentBanner — accept flow", () => {
  it("clicking accept persists consent to localStorage", async () => {
    render(<ConsentBanner />);
    await waitFor(() => screen.getByText(/I Accept — Continue/i));
    fireEvent.click(screen.getByText(/I Accept — Continue/i));
    expect(hasConsent()).toBe(true);
  });

  it("clicking accept calls the onConsent callback", async () => {
    const onConsent = vi.fn();
    render(<ConsentBanner onConsent={onConsent} />);
    await waitFor(() => screen.getByText(/I Accept — Continue/i));
    fireEvent.click(screen.getByText(/I Accept — Continue/i));
    expect(onConsent).toHaveBeenCalledTimes(1);
  });

  it("dialog is not rendered after accept (visibility toggled off)", async () => {
    render(<ConsentBanner />);
    await waitFor(() => screen.getByText(/I Accept — Continue/i));
    fireEvent.click(screen.getByText(/I Accept — Continue/i));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});

// ─── useConsent hook ──────────────────────────────────────────────────────────

describe("useConsent hook", () => {
  it("returns false initially when no consent stored", async () => {
    const { result } = renderHook(() => useConsent());
    // Initial render
    expect(result.current).toBe(false);
    // After effect
    await act(async () => {});
    expect(result.current).toBe(false);
  });

  it("returns true when consent is already stored", async () => {
    giveConsent();
    const { result } = renderHook(() => useConsent());
    await act(async () => {});
    expect(result.current).toBe(true);
  });
});

// ─── Privacy policy link ──────────────────────────────────────────────────────

describe("ConsentBanner — privacy policy link", () => {
  it("contains a link to the full privacy policy", async () => {
    render(<ConsentBanner />);
    await waitFor(() => {
      const link = screen.getByText(/Full Privacy Policy/i);
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute("href", "/privacy");
    });
  });
});
