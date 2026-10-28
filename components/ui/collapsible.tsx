"use client"

import * as React from "react"
import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"

function Collapsible({
  asChild,
  children,
  render,
  ...props
}: CollapsiblePrimitive.Root.Props & { asChild?: boolean }) {
  const finalRender =
    asChild && React.isValidElement(children)
      ? (children as React.ReactElement)
      : render
  return (
    <CollapsiblePrimitive.Root
      data-slot="collapsible"
      render={finalRender}
      {...props}
    >
      {asChild ? undefined : children}
    </CollapsiblePrimitive.Root>
  )
}

function CollapsibleTrigger({
  asChild,
  children,
  render,
  ...props
}: CollapsiblePrimitive.Trigger.Props & { asChild?: boolean }) {
  const finalRender =
    asChild && React.isValidElement(children)
      ? (children as React.ReactElement)
      : render
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      render={finalRender}
      {...props}
    >
      {asChild && React.isValidElement(children)
        ? (children.props as any).children
        : children}
    </CollapsiblePrimitive.Trigger>
  )
}

function CollapsibleContent({ ...props }: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel data-slot="collapsible-content" {...props} />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
