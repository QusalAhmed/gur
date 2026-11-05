"use client";

import * as React from "react";
import Link from "next/link";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  MarkerType,
  Node,
  Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { UiProductItem, UiProductVariantItem } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package2, ExternalLink, Layers, Table as TableIcon } from "lucide-react";

const stockStyle: Record<string, string> = {
  in_stock: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  low_stock: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  out_of_stock: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  backorder: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
};

// 1. Custom Product Root Node
function ProductRootNode({ data }: { data: { product: UiProductItem } }) {
  const p = data.product;
  return (
    <div className="rounded-xl border-2 border-amber-500 bg-background/95 dark:bg-card/95 p-3 shadow-md w-[230px] text-xs relative group transition-all duration-200">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-10 w-10 rounded-lg bg-muted/60 border border-border flex items-center justify-center shrink-0 overflow-hidden relative shadow-2xs">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
          ) : (
            <Package2 className="h-5 w-5 text-amber-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Badge className="h-4 px-1.5 text-[9px] bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-medium">
            Product
          </Badge>
          <div className="font-bold text-foreground text-xs line-clamp-1 mt-0.5" title={p.name}>
            {p.name}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 border-t border-border/70">
        <span className="truncate max-w-[120px]">{p.category}</span>
        <span className="font-semibold text-foreground">
          {p.basePrice ? `৳${Number(p.basePrice).toLocaleString()}` : "–"}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-amber-500 !w-3.5 !h-3.5 !border-2 !border-background !-right-2 shadow-xs cursor-crosshair"
      />
    </div>
  );
}

// 2. Custom Variant Child Node
function VariantChildNode({
  data,
}: {
  data: { variant: UiProductVariantItem; productId: string };
}) {
  const v = data.variant;
  return (
    <div className="rounded-xl border border-border/80 bg-background/95 dark:bg-card/95 p-3 shadow-xs w-[290px] text-xs relative transition-all duration-200 hover:shadow-md hover:border-amber-500/60">
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-amber-500 !w-3.5 !h-3.5 !border-2 !border-background !-left-2 shadow-xs cursor-crosshair"
      />
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0 font-medium border-border/80 shrink-0">
            {v.packType}
          </Badge>
          <span className="font-semibold text-foreground truncate" title={v.name}>
            {v.name}
          </span>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.2 text-[10px] font-semibold capitalize border shrink-0 ${
            stockStyle[v.stockStatus] || "bg-muted text-muted-foreground"
          }`}
        >
          {v.stockStatus.replace("_", " ")}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground pt-1.5 border-t border-border/60">
        <div>
          <span className="text-[10px] uppercase font-mono text-muted-foreground/70">SKU: </span>
          <span className="font-mono font-semibold text-foreground text-[10px]">{v.sku}</span>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase text-muted-foreground/70">Pack: </span>
          <span className="font-medium text-foreground">
            {v.netQuantity} {v.netUnit}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase text-muted-foreground/70">Price: </span>
          <span className="font-bold text-foreground">৳{v.price.toLocaleString()}</span>
        </div>
        <div className="text-right">
          <Link
            href={`/admin/products/${data.productId}/edit?tab=variants`}
            className="text-amber-600 dark:text-amber-400 hover:underline font-medium inline-flex items-center gap-0.5 text-[11px]"
          >
            Edit SKU <ExternalLink className="h-2.5 w-2.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  productRoot: ProductRootNode,
  variantChild: VariantChildNode,
};

export interface ProductVariantsFlowProps {
  product: UiProductItem;
}

export function ProductVariantsFlow({ product }: ProductVariantsFlowProps) {
  const variants = product.variantList || [];

  const { nodes, edges, canvasHeight } = React.useMemo(() => {
    if (variants.length === 0) {
      return { nodes: [], edges: [], canvasHeight: 120 };
    }

    const itemHeight = 90;
    const verticalGap = 16;
    const step = itemHeight + verticalGap;
    const totalVariantHeight = variants.length * step - verticalGap;
    const computedHeight = Math.max(160, totalVariantHeight + 40);

    const productNodeY = Math.max(20, (totalVariantHeight - 75) / 2);

    const flowNodes: Node[] = [
      {
        id: `product-${product.id}`,
        type: "productRoot",
        position: { x: 25, y: productNodeY },
        data: { product },
      },
    ];

    const flowEdges: Edge[] = [];

    variants.forEach((v, index) => {
      const variantNodeId = `variant-${v.id}`;
      const variantNodeY = 20 + index * step;

      flowNodes.push({
        id: variantNodeId,
        type: "variantChild",
        position: { x: 330, y: variantNodeY },
        data: { variant: v, productId: product.id },
      });

      flowEdges.push({
        id: `edge-${product.id}-${v.id}`,
        source: `product-${product.id}`,
        target: variantNodeId,
        type: "smoothstep",
        animated: true,
        style: {
          stroke: "#f59e0b",
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#f59e0b",
          width: 14,
          height: 14,
        },
      });
    });

    return {
      nodes: flowNodes,
      edges: flowEdges,
      canvasHeight: computedHeight,
    };
  }, [product, variants]);

  if (variants.length === 0) {
    return null;
  }

  return (
    <div
      style={{ height: `${canvasHeight}px` }}
      className="w-full relative rounded-lg border border-border/70 bg-muted/15 dark:bg-card/40 overflow-hidden shadow-2xs"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#f59e0b" className="opacity-15" />
      </ReactFlow>
    </div>
  );
}
