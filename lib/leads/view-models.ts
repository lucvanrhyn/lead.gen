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
  approvalStatus?: string;
};

export type ApprovalQueueSummary = {
  pendingApprovalCount: number;
  approvedCount: number;
  syncedDraftCount: number;
};

export type GoogleWorkspaceStatusViewModel = {
  status: "CONFIG_INCOMPLETE" | "DISCONNECTED" | "ERROR" | "CONNECTED";
  canStartOAuth: boolean;
  connectedEmail?: string;
  title: string;
  description: string;
};

export type ApprovalQueueItem = {
  draftId: string;
  leadId: string;
  companyName: string;
  contactName?: string;
  emailSubject: string;
  approvalStatus: string;
  gmailSyncStatus: string;
  sheetSyncStatus: string;
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
    hasWebsite: boolean;
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
  leadMagnets: Array<{
    id: string;
    title: string;
    type: string;
    summary: string;
    whyItMatchesTheLead: string;
    suggestedDeliveryFormat: string;
  }>;
  outreachDrafts: Array<{
    id: string;
    emailSubject1: string;
    emailSubject2: string;
    coldEmailShort: string;
    coldEmailMedium: string;
    followUp1: string;
    approvalStatus: string;
    gmailSyncStatus: string;
    sheetSyncStatus: string;
  }>;
  diagnosticForms: Array<{
    id: string;
    formTitle: string;
    estimatedCompletionTime: string;
    industry: string;
    outreachCtaShort: string;
    googleFormUrl?: string;
    responseStatus: string;
  }>;
};
