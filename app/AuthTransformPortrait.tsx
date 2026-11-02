"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type PointerEvent } from "react";

const ORIGINAL_VISIBLE_BOUNDS = { left: 135 / 1024, right: 924 / 1024, top: 37 / 1536 };
const TRANSFORMED_VISIBLE_BOUNDS = { left: 13 / 604, right: 592 / 604, top: 13 / 725 };
const ORIGINAL_PORTRAIT_SCALE = 0.94;

export default function AuthTransformPortrait() {
  const control = useRef<HTMLButtonElement>(null);
  const original = useRef<HTMLImageElement>(null);
  const transformed = useRef<HTMLImageElement>(null);
  const [fullTransform, setFullTransform] = useState(false);

  useEffect(() => {
    const buttonElement = control.current;
    const originalElement = original.current;
    const transformedElement = transformed.current;
    if (!buttonElement || !originalElement || !transformedElement) return;

    function syncCharacterSize() {
      if (!buttonElement || !originalElement || !transformedElement) return;
      if (!originalElement.naturalWidth || !transformedElement.naturalWidth) return;
      const width = buttonElement.clientWidth;
      const height = buttonElement.clientHeight;
      if (!width || !height) return;

      const originalFit = Math.min(width / originalElement.naturalWidth, height / originalElement.naturalHeight);
      const transformedFit = Math.min(width / transformedElement.naturalWidth, height / transformedElement.naturalHeight);
      const originalHeight = originalElement.naturalHeight * originalFit * ORIGINAL_PORTRAIT_SCALE;
      const transformedHeight = transformedElement.naturalHeight * transformedFit;
      const scale = originalHeight / transformedHeight;
      const originalWidth = originalElement.naturalWidth * originalFit * ORIGINAL_PORTRAIT_SCALE;
      const transformedWidth = transformedElement.naturalWidth * transformedFit;
      const originalCenterX = width / 2 + ((ORIGINAL_VISIBLE_BOUNDS.left + ORIGINAL_VISIBLE_BOUNDS.right) / 2 - 0.5) * originalWidth;
      const transformedCenterX = width / 2 + ((TRANSFORMED_VISIBLE_BOUNDS.left + TRANSFORMED_VISIBLE_BOUNDS.right) / 2 - 0.5) * transformedWidth * scale;
      const originalTop = height - originalHeight + ORIGINAL_VISIBLE_BOUNDS.top * originalHeight;
      const transformedTop = (height - transformedHeight + TRANSFORMED_VISIBLE_BOUNDS.top * transformedHeight) * scale;

      buttonElement.style.setProperty("--transform-scale", String(scale));
      buttonElement.style.setProperty("--portrait-scale", String(ORIGINAL_PORTRAIT_SCALE));
      buttonElement.style.setProperty("--transform-offset-x", `${originalCenterX - transformedCenterX - width * 0.15}px`);
      buttonElement.style.setProperty("--transform-offset-y", `${originalTop - transformedTop}px`);
    }

    originalElement.addEventListener("load", syncCharacterSize);
    transformedElement.addEventListener("load", syncCharacterSize);
    const observer = new ResizeObserver(syncCharacterSize);
    observer.observe(buttonElement);
    syncCharacterSize();

    return () => {
      observer.disconnect();
      originalElement.removeEventListener("load", syncCharacterSize);
      transformedElement.removeEventListener("load", syncCharacterSize);
    };
  }, []);

  function trackPointer(event: PointerEvent<HTMLButtonElement>) {
    if (fullTransform) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const scale = Number.parseFloat(getComputedStyle(event.currentTarget).getPropertyValue("--transform-scale")) || 1;
    const offsetX = Number.parseFloat(getComputedStyle(event.currentTarget).getPropertyValue("--transform-offset-x")) || 0;
    const offsetY = Number.parseFloat(getComputedStyle(event.currentTarget).getPropertyValue("--transform-offset-y")) || 0;
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    event.currentTarget.style.setProperty("--original-transform-x", `${x}px`);
    event.currentTarget.style.setProperty("--original-transform-y", `${y}px`);
    event.currentTarget.style.setProperty("--transform-x", `${(x - bounds.width / 2 - offsetX) / scale + bounds.width / 2}px`);
    event.currentTarget.style.setProperty("--transform-y", `${(y - offsetY) / scale}px`);
    event.currentTarget.dataset.transforming = "true";
  }

  return <div className="auth-portrait-stage">
    <div className="auth-orbit auth-orbit-back" aria-hidden="true"><i /><i /></div>
    <div className="auth-orbit auth-orbit-front" aria-hidden="true"><i /><i /></div>
    <button
      ref={control}
      className="auth-portrait-control"
      type="button"
      data-transforming="false"
      data-full-transform={fullTransform}
      aria-pressed={fullTransform}
      aria-label={fullTransform ? "ត្រឡប់ទៅរូបដើម" : "បម្លែងរូបភាព"}
      onClick={() => setFullTransform(current => !current)}
      onPointerEnter={trackPointer}
      onPointerMove={trackPointer}
      onPointerLeave={event => { event.currentTarget.dataset.transforming = "false"; }}
    >
      <Image
        ref={original}
        src="/images/rith-welcome-cutout.png"
        alt="រូបភាព RITH ក្នុងឈុតអាវធំពណ៌ខ្មៅ"
        fill
        sizes="(max-width:680px) 44vw, (max-width:880px) 67vw, 410px"
        priority
        className="auth-cutout-original"
      />
      <Image
        ref={transformed}
        src="/images/rith-transformation-cutout.png"
        alt=""
        aria-hidden="true"
        fill
        sizes="(max-width:680px) 44vw, (max-width:880px) 67vw, 410px"
        className="auth-cutout-transformed"
      />
    </button>
    <span className="auth-transform-hint" aria-hidden="true">ដាក់កណ្ដុរលើរូប ឬចុចដើម្បី Transform</span>
  </div>;
}
