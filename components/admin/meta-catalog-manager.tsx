"use client";

import * as React from "react";
import {
  Share2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  UploadCloud,
  Database,
  Layers,
  Info,
  Key,
  ShieldCheck,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getMetaCatalogConfigAction,
  testMetaCatalogConnectionAction,
  fetchMetaCatalogProductsAction,
  syncAllProductsToMetaCatalogAction,
  type SafeMetaConfig,
} from "@/actions/meta-catalog";
import type { MetaFetchedProduct, MetaCatalogDetails } from "@/lib/meta-catalog";

interface MetaCatalogManagerProps {
  triggerButtonVariant?: "default" | "outline" | "secondary";
  className?: string;
}

export function MetaCatalogManager({
  triggerButtonVariant = "outline",
  className,
}: MetaCatalogManagerProps) {
  const [open, setOpen] = React.useState(false);
  const [loadingConfig, setLoadingConfig] = React.useState(true);
  const [config, setConfig] = React.useState<SafeMetaConfig | null>(null);

  // Connection Test State
  const [testingConnection, setTestingConnection] = React.useState(false);
  const [connectionDetails, setConnectionDetails] = React.useState<MetaCatalogDetails | null>(null);
  const [connectionError, setConnectionError] = React.useState<string | null>(null);

  // Sync State
  const [syncing, setSyncing] = React.useState(false);
  const [syncResult, setSyncResult] = React.useState<{
    success: boolean;
    syncedCount: number;
    createdCount: number;
    updatedCount: number;
    handles: string[];
    error?: string;
    items: Array<{ id: string; title: string; price: string; method: string }>;
  } | null>(null);

  // Fetch Live Catalog Products State
  const [fetchingProducts, setFetchingProducts] = React.useState(false);
  const [liveProducts, setLiveProducts] = React.useState<MetaFetchedProduct[]>([]);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  // Manual Overrides
  const [customCatalogId, setCustomCatalogId] = React.useState("");
  const [customToken, setCustomToken] = React.useState("");

  const loadConfig = React.useCallback(async () => {
    setLoadingConfig(true);
    try {
      const res = await getMetaCatalogConfigAction();
      if (res.success && res.config) {
        setConfig(res.config);
        if (res.config.catalogId) {
          setCustomCatalogId(res.config.catalogId);
        }
      }
    } catch (err: any) {
      console.error("Failed to load Meta Catalog config:", err);
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      loadConfig();
    }
  }, [open, loadConfig]);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionError(null);
    setConnectionDetails(null);

    try {
      const res = await testMetaCatalogConnectionAction({
        catalogId: customCatalogId.trim() || undefined,
        accessToken: customToken.trim() || undefined,
      });

      if (res.success && res.details) {
        setConnectionDetails(res.details);
      } else {
        setConnectionError(res.error || "Connection failed. Please check catalog ID and permissions.");
      }
    } catch (err: any) {
      setConnectionError(err?.message || "Unexpected error testing connection.");
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const res = await syncAllProductsToMetaCatalogAction({
        catalogId: customCatalogId.trim() || undefined,
        accessToken: customToken.trim() || undefined,
        mode: "auto",
      });

      setSyncResult(res);
    } catch (err: any) {
      setSyncResult({
        success: false,
        syncedCount: 0,
        createdCount: 0,
        updatedCount: 0,
        handles: [],
        error: err?.message || "Sync failed",
        items: [],
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleFetchLiveProducts = async () => {
    setFetchingProducts(true);
    setFetchError(null);

    try {
      const res = await fetchMetaCatalogProductsAction({
        catalogId: customCatalogId.trim() || undefined,
        accessToken: customToken.trim() || undefined,
        limit: 20,
      });

      if (res.success) {
        setLiveProducts(res.products);
      } else {
        setFetchError(res.error || "Failed to fetch live products from Meta Catalog.");
      }
    } catch (err: any) {
      setFetchError(err?.message || "Error fetching products.");
    } finally {
      setFetchingProducts(false);
    }
  };

  const isReady = Boolean(customCatalogId.trim() || config?.catalogId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={triggerButtonVariant}
          size="sm"
          className={`h-9 gap-1.5 cursor-pointer font-medium ${className}`}
        >
          <Share2 className="h-4 w-4 text-[#1877F2]" />
          <span>Meta Catalog Sync</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 pb-8">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[#1877F2]/10 flex items-center justify-center text-[#1877F2]">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Meta Business SDK & Catalog Integration
              </DialogTitle>
              <DialogDescription className="text-xs">
                Synchronize e-commerce products with Meta Catalog for Facebook & Instagram Shop, Dynamic Ads, and Pixel matching.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2 pb-4">
          {/* Status Bar */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="bg-muted/30 border-muted">
              <CardContent className="p-3 text-xs">
                <span className="text-muted-foreground block text-[11px] mb-1">Catalog ID</span>
                <span className="font-mono font-semibold text-foreground truncate block">
                  {customCatalogId.trim() || config?.catalogId || "Not Configured"}
                </span>
              </CardContent>
            </Card>

            <Card className="bg-muted/30 border-muted">
              <CardContent className="p-3 text-xs">
                <span className="text-muted-foreground block text-[11px] mb-1">Access Token</span>
                <span className="font-mono text-foreground truncate block">
                  {config?.maskedToken || (customToken ? "Custom Token Provided" : "Missing Token")}
                </span>
              </CardContent>
            </Card>

            <Card className="bg-muted/30 border-muted">
              <CardContent className="p-3 text-xs">
                <span className="text-muted-foreground block text-[11px] mb-1">Status</span>
                {isReady ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px]">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Ready to Sync
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/10 text-[11px]">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Needs Catalog ID
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Configuration Inputs */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Key className="h-4 w-4 text-amber-600" />
                Catalog Credentials & Identifiers
              </CardTitle>
              <CardDescription className="text-xs">
                Configured via <code className="text-xs bg-muted px-1 py-0.5 rounded">.env</code> or customized below.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Meta Catalog ID
                  </label>
                  <Input
                    placeholder="e.g. 102938475610293"
                    value={customCatalogId}
                    onChange={(e) => setCustomCatalogId(e.target.value)}
                    className="font-mono text-xs h-9"
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Find this under Commerce Manager &rarr; Catalog &rarr; Settings.
                  </span>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Custom Access Token (Optional)
                  </label>
                  <Input
                    type="password"
                    placeholder="Defaults to FACEBOOK_CAPI_ACCESS_TOKEN"
                    value={customToken}
                    onChange={(e) => setCustomToken(e.target.value)}
                    className="font-mono text-xs h-9"
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Requires <code className="text-[10px]">catalog_management</code> permission.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testingConnection || !isReady}
                  className="h-8 text-xs cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${testingConnection ? "animate-spin" : ""}`} />
                  Test Connection
                </Button>

                {config?.catalogId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    asChild
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <a
                      href={`https://business.facebook.com/commerce/catalogs/${config.catalogId}/products`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      Open Commerce Manager
                    </a>
                  </Button>
                )}
              </div>

              {/* Connection Test Results */}
              {connectionDetails && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs space-y-1 text-emerald-800 dark:text-emerald-300">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Connected to Catalog: {connectionDetails.name}
                  </div>
                  <div className="text-[11px] opacity-90 pl-5">
                    Catalog ID: <code className="font-mono">{connectionDetails.id}</code> &bull; Current Items:{" "}
                    <strong>{connectionDetails.productCount}</strong> &bull; Feeds:{" "}
                    <strong>{connectionDetails.feedCount}</strong>
                  </div>
                </div>
              )}

              {connectionError && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    Connection Failed
                  </div>
                  <div className="text-[11px] pl-5 break-all">{connectionError}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sync Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Card className="flex-1">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <UploadCloud className="h-4 w-4 text-[#1877F2]" />
                  Sync Products to Meta
                </CardTitle>
                <CardDescription className="text-xs">
                  Transforms all active database items & variants into Meta Catalog format and batch uploads them.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <Button
                  onClick={handleSyncAll}
                  disabled={syncing || !isReady}
                  className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white cursor-pointer h-9 text-xs font-semibold"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-2 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Synchronizing to Meta..." : "Sync All Active Products"}
                </Button>
              </CardContent>
            </Card>

            <Card className="flex-1">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-amber-600" />
                  Fetch Live Catalog Items
                </CardTitle>
                <CardDescription className="text-xs">
                  Queries products currently live in your Meta Catalog to verify sync status.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <Button
                  variant="outline"
                  onClick={handleFetchLiveProducts}
                  disabled={fetchingProducts || !isReady}
                  className="w-full cursor-pointer h-9 text-xs font-semibold"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-2 ${fetchingProducts ? "animate-spin" : ""}`} />
                  {fetchingProducts ? "Fetching from Meta..." : "Fetch Live Catalog Items"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sync Result Banner */}
          {syncResult && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-2 ${
                syncResult.success
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}
            >
              <div className="flex items-center justify-between font-semibold">
                <span className="flex items-center gap-1.5">
                  {syncResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  {syncResult.success ? "Catalog Synchronization Complete" : "Sync Failed"}
                </span>
                {syncResult.success && (
                  <Badge variant="outline" className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px]">
                    {syncResult.syncedCount} Items Sent
                  </Badge>
                )}
              </div>

              {syncResult.error && (
                <div className="text-[11px] text-destructive break-all">{syncResult.error}</div>
              )}

              {syncResult.items && syncResult.items.length > 0 && (
                <div className="mt-2 pt-2 border-t border-emerald-500/20 max-h-40 overflow-y-auto space-y-1">
                  <span className="text-[11px] font-medium block">Batched Items:</span>
                  {syncResult.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-[11px] bg-background/50 p-1.5 rounded"
                    >
                      <span className="truncate max-w-[280px]">
                        <strong>{it.title}</strong>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-muted-foreground">{it.price}</span>
                        <Badge variant="outline" className="text-[9px] uppercase">
                          {it.method}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Live Catalog Table */}
          {liveProducts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-muted-foreground" />
                  Products Live on Meta Catalog ({liveProducts.length})
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLiveProducts([])}
                  className="h-6 text-[11px]"
                >
                  Clear Preview
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 text-muted-foreground text-[10px] uppercase">
                    <tr>
                      <th className="p-2">Image</th>
                      <th className="p-2">Product Name</th>
                      <th className="p-2">Retailer ID</th>
                      <th className="p-2">Price</th>
                      <th className="p-2">Availability</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {liveProducts.map((p, idx) => (
                      <tr key={idx} className="hover:bg-muted/20">
                        <td className="p-2 w-12">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt=""
                              className="h-8 w-8 rounded object-cover border"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-[9px]">
                              N/A
                            </div>
                          )}
                        </td>
                        <td className="p-2 font-medium truncate max-w-[200px]">{p.name || p.title}</td>
                        <td className="p-2 font-mono text-[10px] text-muted-foreground">{p.retailerId || p.id}</td>
                        <td className="p-2 font-mono">{p.price || "-"}</td>
                        <td className="p-2">
                          <Badge
                            variant="outline"
                            className={`text-[9px] ${
                              p.availability === "in stock"
                                ? "text-emerald-600 border-emerald-500/30"
                                : "text-amber-600 border-amber-500/30"
                            }`}
                          >
                            {p.availability || "unknown"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {fetchError && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive">
              {fetchError}
            </div>
          )}

          {/* Quick Help Guide */}
          <div className="p-3 bg-muted/40 rounded-lg text-[11px] text-muted-foreground space-y-1">
            <div className="flex items-center gap-1 font-semibold text-foreground">
              <Info className="h-3.5 w-3.5 text-blue-500" />
              Meta Commerce Integration Notes:
            </div>
            <ul className="list-disc list-inside space-y-0.5 pl-1">
              <li>
                Each catalog item ID matches the <code>content_ids</code> dispatched by Meta Pixel and CAPI for instant Dynamic Product Ads (DPA) attribution.
              </li>
              <li>
                Batch sync sends requests via Meta Business SDK with chunking up to 4,999 items per request.
              </li>
              <li>
                To automatically sync via CLI or Cron, execute <code>npm run meta:sync</code>.
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

