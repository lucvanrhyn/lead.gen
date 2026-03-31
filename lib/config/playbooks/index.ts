import type { IndustryPlaybook } from "@/lib/config/playbooks/types";

import { accountingPlaybook } from "@/lib/config/playbooks/accounting";
import { dentalClinicPlaybook } from "@/lib/config/playbooks/dental-clinic";
import { generalPlaybook } from "@/lib/config/playbooks/general";
import { homeServicesPlaybook } from "@/lib/config/playbooks/home-services";
import { lawFirmPlaybook } from "@/lib/config/playbooks/law-firm";
import { realEstatePlaybook } from "@/lib/config/playbooks/real-estate";

export type { IndustryPlaybook };

export {
  accountingPlaybook,
  dentalClinicPlaybook,
  generalPlaybook,
  homeServicesPlaybook,
  lawFirmPlaybook,
  realEstatePlaybook,
};

const allPlaybooks: IndustryPlaybook[] = [
  dentalClinicPlaybook,
  lawFirmPlaybook,
  accountingPlaybook,
  realEstatePlaybook,
  homeServicesPlaybook,
];

export function resolvePlaybook(industry: string | null): IndustryPlaybook {
  if (!industry) return generalPlaybook;

  const normalized = industry.toLowerCase();

  for (const playbook of allPlaybooks) {
    if (playbook.aliases.some((alias) => normalized.includes(alias))) {
      return playbook;
    }
  }

  return generalPlaybook;
}
