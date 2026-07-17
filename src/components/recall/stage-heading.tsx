"use client";

import { useEffect, useRef, type ReactNode } from "react";

type StageHeadingProps = {
  id: string;
  children: ReactNode;
};

export function StageHeading({ id, children }: StageHeadingProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <h1 ref={headingRef} id={id} className="stage-heading" tabIndex={-1}>
      {children}
    </h1>
  );
}
