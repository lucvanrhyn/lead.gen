export type LeadTableRow = {
  id: string;
  name: string;
  website?: string;
  industry?: string;
  locationSummary?: string;
  score?: number;
  scoreLabel: string;
  painConfidence?: number;
  sourceConfidence?: number;
  contactsCount: number;
  manualReviewRequired: boolean;
  status: string;
};

export type LeadDetailViewModel = {
  company: {
    id: string;
    name: string;
    website?: string;
    industry?: string;
    locationSummary?: string;
    phone?: string;
    description?: string;
    scoreLabel: string;
    sourceConfidenceLabel: string;
    manualReviewRequired: boolean;
    status: string;
  };
  contacts: Array<{
    id: string;
    fullName: string;
    title?: string;
    email?: string;
    phone?: string;
    confidenceLabel: string;
  }>;
  technologies: Array<{
    id: string;
    name: string;
    category?: string;
    confidenceLabel: string;
  }>;
  newsMentions: Array<{
    id: string;
    title: string;
    sourceName?: string;
    articleUrl: string;
  }>;
  painHypotheses: Array<{
    id: string;
    primaryPain: string;
    confidenceLabel: string;
    businessImpact: string;
    recommendedServiceAngle: string;
  }>;
  outreachDrafts: Array<{
    id: string;
    emailSubject1: string;
    coldEmailShort: string;
  }>;
};
