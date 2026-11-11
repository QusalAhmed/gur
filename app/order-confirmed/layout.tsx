import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "অর্ডার নিশ্চিতকরণ",
  robots: {
    index: false,
    follow: false,
  },
};

export default function OrderConfirmedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
