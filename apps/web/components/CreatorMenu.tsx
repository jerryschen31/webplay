"use client";

import { useState } from "react";

const LINKS = [
  { label: "Github", href: "https://github.com/jerryschen31" },
  { label: "Buy me a Coffee", href: "https://buymeacoffee.com/jerryschen7" },
];

export function CreatorMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          top: "1.25rem",
          left: "1.25rem",
          zIndex: 3,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "5px",
          width: "2.75rem",
          height: "2.75rem",
          padding: "0 0.7rem",
          borderRadius: "999px",
          border: "1px solid rgba(255,255,255,0.4)",
          background: "rgba(255,255,255,0.12)",
          backdropFilter: "blur(6px)",
          cursor: "pointer",
        }}
      >
        {[0, 1, 2].map((line) => (
          <span
            key={line}
            style={{
              display: "block",
              height: "2px",
              borderRadius: "1px",
              background: "#fff",
            }}
          />
        ))}
      </button>
      {open && (
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1,
            background: "rgba(10, 8, 18, 0.35)",
          }}
        />
      )}
      <nav
        aria-label="Creator links"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 2,
          width: "min(17rem, 80vw)",
          padding: "5.5rem 1.75rem 2rem",
          textAlign: "left",
          color: "#fff",
          background: "rgba(10, 8, 18, 0.65)",
          backdropFilter: "blur(12px)",
          borderRight: "1px solid rgba(255,255,255,0.15)",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
        }}
      >
        <p
          style={{
            marginBottom: "1.5rem",
            fontSize: "0.8rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            opacity: 0.7,
          }}
        >
          Created by Jerry Chen
        </p>
        {LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              marginBottom: "1rem",
              color: "#fff",
              textDecoration: "none",
              fontSize: "1.05rem",
              textShadow: "0 1px 8px rgba(0,0,0,0.5)",
            }}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </>
  );
}
