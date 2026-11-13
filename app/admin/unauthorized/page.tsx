import Link from "next/link";
import { ShieldAlert, ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <Card className="max-w-md w-full border-border/80 shadow-md">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            403 · Access Denied
          </CardTitle>
          <CardDescription className="text-sm mt-1">
            আপনার অ্যাকাউন্টের এই পেজে প্রবেশের অনুমতি নেই (Role restricted)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4 text-center">
          <p className="text-sm text-muted-foreground">
            You are signed in as a staff member, but your assigned role does not have permission to view or manage this section.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            <Button asChild variant="default" className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/login">
                <LogOut className="mr-2 h-4 w-4" />
                Switch Account
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
