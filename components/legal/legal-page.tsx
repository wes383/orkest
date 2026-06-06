import Link from "next/link";
import { LegalMarkdownText } from "@/components/legal/legal-markdown";
import legalContent from "@/lib/legal/content.json";

const LEGAL_CONTENT = legalContent as Record<string, string>;

interface LegalPageProps {
  fileName: string;
  title: string;
  currentPage?: "privacy" | "terms" | "refund";
}

export async function LegalPage({ fileName, title, currentPage }: LegalPageProps) {
  const content = LEGAL_CONTENT[fileName] || "Failed to load content.";

  return (
    <div className="flex min-h-screen flex-col items-center bg-white dark:bg-[#0a0a0a]">
      <div className="w-full max-w-3xl px-6 py-16">
        <div className="mb-8 flex items-center gap-4 text-sm">
          <Link
            href="/"
            className="text-[#6b6b6b] hover:text-[#000] dark:text-[#888] dark:hover:text-[#fff]"
          >
            Back to Orkest
          </Link>
          <span className="text-[#ccc] dark:text-[#444]">|</span>
          <Link
            href="/privacy-policy"
            className={currentPage === "privacy" ? "text-[#000] dark:text-[#fff]" : "text-[#6b6b6b] hover:text-[#000] dark:text-[#888] dark:hover:text-[#fff]"}
          >
            Privacy
          </Link>
          <span className="text-[#ccc] dark:text-[#444]">|</span>
          <Link
            href="/terms-of-service"
            className={currentPage === "terms" ? "text-[#000] dark:text-[#fff]" : "text-[#6b6b6b] hover:text-[#000] dark:text-[#888] dark:hover:text-[#fff]"}
          >
            Terms
          </Link>
          <span className="text-[#ccc] dark:text-[#444]">|</span>
          <Link
            href="/refund-policy"
            className={currentPage === "refund" ? "text-[#000] dark:text-[#fff]" : "text-[#6b6b6b] hover:text-[#000] dark:text-[#888] dark:hover:text-[#fff]"}
          >
            Refund Policy
          </Link>
        </div>
        <article className="prose prose-sm max-w-none dark:prose-invert">
          <h1 className="mb-6 text-2xl font-semibold text-[#111] dark:text-[#f5f5f5]">
            {title}
          </h1>
          <div className="text-[#3c3841] dark:text-[#d4d4d4]">
            <LegalMarkdownText>{content}</LegalMarkdownText>
          </div>
        </article>
        <footer className="mt-16 border-t border-[#e5e5e5] pt-6 text-center text-xs text-[#888] dark:border-[#222] dark:text-[#666]">
          <p>© {new Date().getFullYear()} Orkest. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
