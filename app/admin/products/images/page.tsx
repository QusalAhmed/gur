"use client";

import { motion } from "motion/react";
import { Plus, Search, Image as ImageIcon, UploadCloud, CheckCircle2, Star, Trash2, ArrowLeft, MoreHorizontal, Grid } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const gallery = [
  {
    id: "IMG-001",
    product: "Blackstrap Molasses",
    alt: "Blackstrap Molasses 200L Drum Industrial Packaging",
    dimensions: "1200 x 1200 px",
    size: "420 KB",
    isPrimary: true,
    displayOrder: 1,
    emoji: "🏺",
    color: "bg-amber-950/20 text-amber-700",
  },
  {
    id: "IMG-002",
    product: "Blackstrap Molasses",
    alt: "High viscosity pour testing in laboratory",
    dimensions: "1920 x 1080 px",
    size: "680 KB",
    isPrimary: false,
    displayOrder: 2,
    emoji: "🔬",
    color: "bg-stone-900/10 text-stone-700",
  },
  {
    id: "IMG-003",
    product: "Date Palm Liquid Nolen Gur",
    alt: "Freshly harvested Khejur Gur bottle presentation with earthen pot",
    dimensions: "1200 x 1200 px",
    size: "510 KB",
    isPrimary: true,
    displayOrder: 1,
    emoji: "🍯",
    color: "bg-amber-100 text-amber-800",
  },
  {
    id: "IMG-004",
    product: "Date Palm Patali Block",
    alt: "Solid clay molded Patali Gur block cut in half",
    dimensions: "1200 x 1200 px",
    size: "490 KB",
    isPrimary: true,
    displayOrder: 1,
    emoji: "🧱",
    color: "bg-amber-200 text-amber-900",
  },
  {
    id: "IMG-005",
    product: "Feed Grade Molasses A",
    alt: "1 Ton IBC Tote Tank on wooden pallet for dairy farms",
    dimensions: "1200 x 1200 px",
    size: "720 KB",
    isPrimary: true,
    displayOrder: 1,
    emoji: "📦",
    color: "bg-blue-100 text-blue-800",
  },
  {
    id: "IMG-006",
    product: "Food Grade Sugarcane Molasses",
    alt: "5kg Yellow Food Grade Pail with tamper-proof seal",
    dimensions: "1200 x 1200 px",
    size: "380 KB",
    isPrimary: true,
    displayOrder: 1,
    emoji: "🪣",
    color: "bg-yellow-100 text-yellow-800",
  },
  {
    id: "IMG-007",
    product: "Organic Date Palm Gur",
    alt: "Lab Certificate of Analysis (COA) purity seal watermark",
    dimensions: "800 x 1100 px",
    size: "290 KB",
    isPrimary: false,
    displayOrder: 2,
    emoji: "📜",
    color: "bg-green-100 text-green-800",
  },
  {
    id: "IMG-008",
    product: "Feed Grade Molasses A",
    alt: "Bulk tanker discharge at customer warehouse depot",
    dimensions: "1920 x 1080 px",
    size: "890 KB",
    isPrimary: false,
    displayOrder: 2,
    emoji: "🚛",
    color: "bg-orange-100 text-orange-800",
  },
];

export default function ProductImagesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <Link href="/admin/products">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Product Images & Media</h1>
            <p className="text-muted-foreground text-sm">
              Manage product media gallery, primary hero shots, package labels, and COA badges
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
            <UploadCloud className="h-4 w-4 mr-2" />
            Upload Media
          </Button>
        </div>
      </motion.div>

      {/* Upload Dropzone Preview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-dashed border-2 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer">
          <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center text-center">
            <div className="h-12 w-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
              <UploadCloud className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold">Drop images here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports WebP, PNG, JPG up to 10MB each. Automatic WebP compression enabled.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filter Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex gap-2">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Filter by product or alt text..." className="pl-8 h-9" />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-48 h-9">
              <SelectValue placeholder="Product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              <SelectItem value="blackstrap">Blackstrap Molasses</SelectItem>
              <SelectItem value="datepalm">Date Palm Liquid Gur</SelectItem>
              <SelectItem value="feed">Feed Grade Molasses A</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">Showing 8 media items</p>
      </motion.div>

      {/* Grid of Images */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      >
        {gallery.map((img) => (
          <Card key={img.id} className="overflow-hidden group hover:shadow-md transition-shadow">
            <div className={`h-44 flex items-center justify-center text-5xl relative ${img.color}`}>
              <span>{img.emoji}</span>
              {img.isPrimary && (
                <Badge className="absolute top-2 left-2 bg-amber-600 text-white text-[10px] px-1.5 py-0.5">
                  <Star className="h-3 w-3 mr-1 fill-white" /> Primary
                </Badge>
              )}
              <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                Order #{img.displayOrder}
              </span>
            </div>
            <CardContent className="p-3">
              <p className="font-semibold text-xs truncate">{img.product}</p>
              <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5" title={img.alt}>
                {img.alt}
              </p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t text-[10px] text-muted-foreground">
                <span>{img.dimensions}</span>
                <span>{img.size}</span>
              </div>
              <div className="flex gap-1 mt-3">
                <Button variant="outline" size="sm" className="h-7 text-xs flex-1">
                  Edit
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>
    </div>
  );
}
