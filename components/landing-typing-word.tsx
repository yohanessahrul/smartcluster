"use client";

import { useEffect, useState } from "react";

const words = ["transparan...", "tertata...", "terpercaya..."];

export function LandingTypingWord() {
  const [wordIndex, setWordIndex] = useState(0);
  const [value, setValue] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentWord = words[wordIndex] ?? words[0];
    const doneTyping = value === currentWord;
    const doneDeleting = value.length === 0;

    const delay = isDeleting ? 45 : doneTyping ? 1200 : 90;

    const timer = window.setTimeout(() => {
      if (!isDeleting && !doneTyping) {
        setValue(currentWord.slice(0, value.length + 1));
        return;
      }

      if (!isDeleting && doneTyping) {
        setIsDeleting(true);
        return;
      }

      if (isDeleting && !doneDeleting) {
        setValue(currentWord.slice(0, value.length - 1));
        return;
      }

      setIsDeleting(false);
      setWordIndex((prev) => (prev + 1) % words.length);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [isDeleting, value, wordIndex]);

  return (
    <span className="inline-flex min-h-[1.2em] items-center text-primary">
      {value}
      <span className="ml-0.5 animate-pulse text-primary/80">|</span>
    </span>
  );
}
