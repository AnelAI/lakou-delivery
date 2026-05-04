import type { Metadata } from "next";
import SwaggerUI from "./SwaggerUI";

export const metadata: Metadata = {
  title: "Lakou Delivery — API Reference",
  description: "Interactive OpenAPI 3.0 documentation for the Lakou Delivery REST API.",
  robots: { index: false, follow: false },
};

export default function ApiDocsPage() {
  return <SwaggerUI specUrl="/api/docs" />;
}
