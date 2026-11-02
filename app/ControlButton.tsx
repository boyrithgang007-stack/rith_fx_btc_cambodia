"use client";

import type { ComponentPropsWithRef } from "react";

type ControlProps = ComponentPropsWithRef<"button"> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "row";
  controlSize?: "sm" | "md" | "icon" | "icon-lg";
};

/** One action-control contract. Existing layout classes and native semantics stay intact. */
export default function ControlButton({variant,controlSize="md",type="button",...props}:ControlProps) {
  return <button {...props} type={type} data-ui-control={variant??(type==="submit"?"primary":"secondary")} data-ui-size={controlSize}/>;
}
