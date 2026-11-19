"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { MousePointerClick, X, Check, Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { STOREFRONT_TEXT } from "@/lib/storefront-i18n";

interface HoverInfo {
  top: number;
  left: number;
  width: number;
  height: number;
  tag: string;
  text: string;
}

export function TextCopier() {
  const [isActive, setIsActive] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [justCopied, setJustCopied] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  const widgetRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Helper to find match in STOREFRONT_TEXT
  const findI18nMatch = useCallback((text: string) => {
    const clean = text.trim();
    if (!clean || clean.length < 2) return null;

    for (const [key, val] of Object.entries(STOREFRONT_TEXT.bn)) {
      if (typeof val === "string") {
        const v = val.trim();
        if (v === clean || v.includes(clean) || clean.includes(v)) {
          return { lang: "bn", key, val: v };
        }
      }
    }

    for (const [key, val] of Object.entries(STOREFRONT_TEXT.en)) {
      if (typeof val === "string") {
        const v = val.trim();
        if (v === clean || v.includes(clean) || clean.includes(v)) {
          return { lang: "en", key, val: v };
        }
      }
    }

    return null;
  }, []);

  // Safe clipboard copy
  const copyToClipboard = async (content: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content);
        return true;
      }
    } catch {
      // Fallback
    }

    try {
      const textArea = document.createElement("textarea");
      textArea.value = content;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const ok = document.execCommand("copy");
      textArea.remove();
      return ok;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (!isActive) {
      setHoverInfo(null);
      return;
    }

    const handlePointerMove = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Ignore our own widget & overlays
      if (
        widgetRef.current?.contains(target) ||
        overlayRef.current?.contains(target) ||
        target.closest("[data-text-copier-ui]")
      ) {
        setHoverInfo(null);
        return;
      }

      const text = target.innerText?.trim() || target.textContent?.trim() || "";
      if (!text || text.length === 0) {
        setHoverInfo(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      // Only highlight if visible
      if (rect.width > 0 && rect.height > 0) {
        setHoverInfo({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
          tag: target.tagName.toLowerCase(),
          text: text.slice(0, 80),
        });
      }
    };

    const handleClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Ignore clicks inside our copier widget
      if (
        widgetRef.current?.contains(target) ||
        overlayRef.current?.contains(target) ||
        target.closest("[data-text-copier-ui]")
      ) {
        return;
      }

      // Prevent navigation / submit while in copy mode
      e.preventDefault();
      e.stopPropagation();

      // Check if user has highlighted text
      const selectedText = window.getSelection()?.toString().trim();
      const rawText =
        selectedText && selectedText.length > 0
          ? selectedText
          : target.innerText?.trim() || target.textContent?.trim() || "";

      if (!rawText) {
        toast.info("No text found in clicked element.");
        return;
      }

      const tag = target.tagName.toLowerCase();
      const parentSection = target.closest(
        "header, nav, main, footer, section, article, form, [role='dialog'], [data-section]"
      );
      const sectionHeading = parentSection
        ?.querySelector("h1, h2, h3, h4")
        ?.textContent?.trim();

      const i18nMatch = findI18nMatch(rawText);

      // Clean formatted prompt ready for Antigravity
      const formatted = [
        `Change Text Request:`,
        `- Page: ${window.location.pathname}`,
        `- Element: <${tag}>`,
        sectionHeading ? `- Section Heading: "${sectionHeading.slice(0, 50)}"` : null,
        i18nMatch
          ? `- i18n Key: STOREFRONT_TEXT.${i18nMatch.lang}.${i18nMatch.key}`
          : null,
        `- Current Text:`,
        `"""`,
        rawText,
        `"""`,
        `- Change to: `,
      ]
        .filter(Boolean)
        .join("\n");

      const ok = await copyToClipboard(formatted);

      if (ok) {
        setJustCopied(rawText.slice(0, 30));
        toast.success("Text & context copied to clipboard!", {
          description: `"${rawText.slice(0, 45)}${rawText.length > 45 ? "..." : ""}"`,
          duration: 3500,
        });
      } else {
        toast.error("Could not copy automatically. Please check clipboard permissions.");
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsActive(false);
        toast.info("Click-to-copy mode disabled.");
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive, findI18nMatch]);

  return (
    <>
      {/* Floating Hover Indicator Box */}
      {isActive && hoverInfo && (
        <div
          ref={overlayRef}
          data-text-copier-ui="true"
          className="pointer-events-none fixed z-[99998] transition-all duration-75 border-2 border-dashed border-amber-500 bg-amber-500/10 rounded-md"
          style={{
            top: hoverInfo.top - window.scrollY,
            left: hoverInfo.left - window.scrollX,
            width: hoverInfo.width,
            height: hoverInfo.height,
          }}
        >
          <div className="absolute -top-7 left-0 max-w-[280px] truncate bg-amber-600 text-white font-mono text-[11px] px-2 py-0.5 rounded shadow-md pointer-events-none flex items-center gap-1.5">
            <span className="font-semibold">&lt;{hoverInfo.tag}&gt;</span>
            <span className="opacity-90 truncate">{hoverInfo.text}</span>
          </div>
        </div>
      )}

      {/* Floating Control Widget */}
      <div
        ref={widgetRef}
        data-text-copier-ui="true"
        className="fixed bottom-24 right-4 z-[99999] select-none font-sans"
      >
        {isMinimized ? (
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900/90 hover:bg-neutral-900 text-white text-xs font-medium rounded-full shadow-xl border border-neutral-700 backdrop-blur transition-transform active:scale-95"
            title="Open Text Copier"
          >
            <MousePointerClick className="w-4 h-4 text-amber-400" />
            <span>Text Copier</span>
          </button>
        ) : (
          <div className="flex flex-col bg-neutral-900/95 text-white rounded-2xl shadow-2xl border border-neutral-700 backdrop-blur p-3 max-w-[320px] transition-all">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                <span className="text-xs font-semibold tracking-wide">
                  Text Context Copier
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="text-neutral-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-neutral-800 transition"
                  title="Minimize"
                >
                  —
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsActive(false);
                    setIsMinimized(true);
                  }}
                  className="text-neutral-400 hover:text-white p-0.5 rounded hover:bg-neutral-800 transition"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="py-2.5">
              <p className="text-[11px] text-neutral-300 leading-relaxed mb-3">
                {isActive ? (
                  <span className="text-amber-300 font-medium flex items-center gap-1">
                    🎯 Click any text on the page to copy its exact text & context!
                  </span>
                ) : (
                  "Enable this mode to click any text on the page and automatically copy it formatted for chat."
                )}
              </p>

              <button
                type="button"
                onClick={() => {
                  const nextState = !isActive;
                  setIsActive(nextState);
                  if (nextState) {
                    toast.success("Text Copier is ACTIVE", {
                      description: "Click any text on the screen to copy it.",
                    });
                  }
                }}
                className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all shadow-md active:scale-98 ${
                  isActive
                    ? "bg-amber-500 hover:bg-amber-400 text-neutral-950 ring-2 ring-amber-300"
                    : "bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-600"
                }`}
              >
                <MousePointerClick className="w-4 h-4" />
                {isActive ? "Copy Mode: ON (Click to Stop)" : "Turn ON Copy Mode"}
              </button>
            </div>

            {justCopied && (
              <div className="mt-1 pt-2 border-t border-neutral-800/80 flex items-center gap-1.5 text-[11px] text-emerald-400">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Last copied: &quot;{justCopied}&quot;</span>
              </div>
            )}

            <div className="mt-2 text-[10px] text-neutral-400 flex items-center justify-between">
              <span>Press <kbd className="px-1 py-0.5 bg-neutral-800 rounded text-neutral-300">Esc</kbd> to stop</span>
              <span className="text-neutral-500">Temporary tool</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
