import * as React from "react";

export interface SlotProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
  [key: string]: unknown;
}

/**
 * Minimal `asChild` slot: clones the single child element and merges
 * className/other props onto it, so compound components (Button) can render
 * a Link or other element while keeping their styling.
 */
export const Slot = React.forwardRef<HTMLElement, SlotProps>(
  ({ children, ...props }, ref) => {
    if (React.isValidElement(children)) {
      const child = children as React.ReactElement<
        React.HTMLAttributes<HTMLElement>
      >;
      const childProps = child.props as React.HTMLAttributes<HTMLElement>;
      const merged = {
        ...childProps,
        ...props,
        className: [childProps.className, props.className].filter(Boolean).join(" "),
      };
      const childRef = (props as { ref?: unknown }).ref;
      const setRef =
        "ref" in child
          ? (child as unknown as { ref: unknown }).ref
          : undefined;
      const mergedRefs = childRef ?? setRef ?? ref;
      return React.cloneElement(child, {
        ...merged,
        // @ts-expect-error ref is a special prop not on HTMLAttributes
        ref: mergedRefs,
      });
    }
    return null;
  }
);
Slot.displayName = "Slot";
