"use client";

import { motion } from "framer-motion";
import { ArrowRight, Bot, Database, Flame, SearchCheck } from "lucide-react";

const stages = [
  {
    title: "Discover",
    description: "Search regional companies through Google Places before touching the open web.",
    icon: SearchCheck,
  },
  {
    title: "Enrich",
    description: "Use Apollo as the default organization and decision-maker source.",
    icon: Database,
  },
  {
    title: "Extract",
    description: "Pull public business-site evidence through Firecrawl and preserve source URLs.",
    icon: Flame,
  },
  {
    title: "Generate",
    description: "Return strict JSON outputs for pains, then score, lead magnet, and outreach.",
    icon: Bot,
  },
];

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 90, damping: 22 },
  },
};

export function PipelinePreview() {
  return (
    <section className="rounded-[3rem] border border-[rgba(210,180,140,0.12)] bg-[rgba(10,8,6,0.58)] p-5 sm:p-6">
      <div className="rounded-[2.5rem] border border-[rgba(210,180,140,0.1)] bg-[rgba(255,255,255,0.03)] p-5">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-serif text-sm uppercase tracking-[0.22em] text-tan">
              Pipeline preview
            </p>
            <h2 className="mt-2 font-display text-3xl text-cream">
              Evidence before outreach
            </h2>
          </div>
          <div className="rounded-full border border-[rgba(210,180,140,0.12)] px-4 py-2 text-sm text-tan">
            Phase 1 scaffold
          </div>
        </div>

        <motion.div
          className="grid gap-4"
          initial="hidden"
          animate="show"
          variants={containerVariants}
        >
          {stages.map(({ title, description, icon: Icon }, index) => (
            <motion.article
              key={title}
              variants={cardVariants}
              className="rounded-[2rem] border border-[rgba(210,180,140,0.12)] bg-[rgba(26,21,16,0.94)] p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-[rgba(139,105,20,0.16)] p-3 text-tan">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-serif text-xs uppercase tracking-[0.24em] text-tan">
                      Step {index + 1}
                    </p>
                    <h3 className="mt-2 font-display text-2xl text-cream">{title}</h3>
                  </div>
                </div>
                <ArrowRight className="mt-1 h-5 w-5 text-[rgba(245,235,212,0.4)]" />
              </div>
              <p className="mt-5 max-w-lg text-sm leading-7 text-[rgba(245,235,212,0.7)]">
                {description}
              </p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
