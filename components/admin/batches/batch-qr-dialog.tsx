"use client";

import * as React from "react";
import QRCode from "qrcode";
import { Download, Printer, QrCode, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BatchItem } from "@/actions/inventory";

interface BatchQRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: BatchItem | null;
}

export function BatchQRDialog({ open, onOpenChange, batch }: BatchQRDialogProps) {
  const [qrDataUrl, setQrDataUrl] = React.useState<string>("");

  const lotUrl = batch
    ? typeof window !== "undefined"
      ? `${window.location.origin}/lot/${batch.batchNo}`
      : `/lot/${batch.batchNo}`
    : "";

  React.useEffect(() => {
    if (open && batch) {
      QRCode.toDataURL(
        lotUrl,
        {
          width: 320,
          margin: 1,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        },
        (err, url) => {
          if (!err && url) {
            setQrDataUrl(url);
          }
        }
      );
    }
  }, [open, batch, lotUrl]);

  if (!batch) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `QR-${batch.batchNo}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <QrCode className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Lot QR Certificate / ব্যাচ কিউআর</DialogTitle>
              <DialogDescription className="text-xs">
                Scan to verify lot origin, lab metrics, and authenticity.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border shadow-xs text-black">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR code for ${batch.batchNo}`}
              className="size-48 object-contain rounded-md"
            />
          ) : (
            <div className="size-48 flex items-center justify-center bg-gray-100 text-xs text-muted-foreground animate-pulse">
              Generating QR...
            </div>
          )}

          <div className="mt-3 text-center space-y-1">
            <span className="font-mono font-bold text-sm tracking-widest block">
              {batch.batchNo}
            </span>
            <span className="text-xs font-medium text-gray-700 block">
              {batch.product}
            </span>
            <div className="flex items-center justify-center gap-2 text-[10px] text-gray-500 font-mono">
              {batch.brix && <span>Brix: {batch.brix}°</span>}
              {batch.ph && <span>pH: {batch.ph}</span>}
              {batch.expDate && <span>BB: {batch.expDate}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span className="truncate max-w-[240px] font-mono text-[11px]">{lotUrl}</span>
          <a
            href={`/lot/${batch.batchNo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline text-xs"
          >
            Visit Page <ExternalLink className="size-3" />
          </a>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={!qrDataUrl}
            className="text-xs gap-1.5"
          >
            <Download className="size-3.5" />
            Download PNG
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handlePrint}
            className="text-xs gap-1.5"
          >
            <Printer className="size-3.5" />
            Print Label
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
