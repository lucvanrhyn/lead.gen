"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Building2 } from "lucide-react";

import { type IndustrySummary } from "@/lib/leads/view-models";

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.06 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 90, damping: 22 },
  },
};

export function IndustryList({ industries }: { industries: IndustrySummary[] }) {
  if (industries.length === 0) {
    return (
      <div className="dashboard-panel rounded-[2rem] p-8 text-[rgba(22,32,51,0.72)]">
        No industries yet. Run Google Places discovery to populate the dashboard.
      </div>
    );
  }

  return (
    <motion.div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      initial="hidden"
      animate="show"
      variants={containerVariants}
    >
      {industries.map((industry) => (
        <motion.div key={industry.slug} variants={cardVariants}>
          <Link
            href={`/leads/industry/${industry.slug}`}
            className="dashboard-panel flex flex-col gap-3 rounded-[2rem] p-6 transition hover:ring-2 hover:ring-[rgba(139,105,20,0.3)]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(139,105,20,0.12)]">
                <Building2 className="h-4 w-4 text-tan" />
              </span>
              <span className="text-sm font-medium uppercase tracking-[0.18em] text-tan">
                Industry
              </span>
            </div>
            <h2 className="font-display text-xl text-[#172033]">{industry.industry}</h2>
            <p className="text-sm text-[rgba(22,32,51,0.6)]">
              {industry.leadCount} lead{industry.leadCount === 1 ? "" : "s"}
            </p>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}
