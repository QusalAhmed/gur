import { Suspense } from "react";
import type { Metadata } from "next";
import { OpenRedirectClient } from "./open-redirect-client";

export const metadata: Metadata = {
  title: "ব্রাউজারে খুলুন | Gramayon",
  description: "ডিফল্ট ব্রাউজারে ওয়েবসাইট ওপেন করার ব্রিজ পেজ",
  robots: {
    index: false,
    follow: false,
  },
};

export default function OpenPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
          <div className="w-10 h-10 rounded-full border-4 border-amber-600 border-t-transparent animate-spin" />
        </div>
      }
    >
      <OpenRedirectClient />
    </Suspense>
  );
}
