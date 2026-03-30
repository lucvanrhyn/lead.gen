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

export type LeadTablePagination = {
  page: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type ApprovalQueueSummary = {
  pendingApprovalCount: number;
  approvedCount: number;
  syncedDraftCount: number;
};

export type CampaignAnalytics = {
  sentCount: number;
  viewedCount: number;
  repliedCount: number;
  followUpDueCount: number;
  suppressedCount: number;
};

export type GoogleWorkspaceStatusViewModel = {
  status: "CONFIG_INCOMPLETE" | "DISCONNECTED" | "ERROR" | "CONNECTED";
  canStartOAuth: boolean;
  connectedEmail?: string;
  title: string;
  description: string;
  lastError?: string;
  gmailWatchStatus?: string;
  gmailWatchExpiresAtLabel?: string;
  gmailWatchLastNotificationAtLabel?: string;
  gmailWatchLastError?: string;
  canRegisterGmailWatch: boolean;
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
  suppressionReason?: string | null;
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
  leadMagnetAssets?: Array<{
    id: string;
    slug: string;
    assetPath: string;
    headline: string;
    intro: string;
    status: string;
    viewCount: number;
    firstViewedAtLabel?: string;
    lastViewedAtLabel?: string;
    followUpCreatedAtLabel?: string;
    diagnosticFormUrl?: string;
  }>;
  outreachDrafts: Array<{
    id: string;
    emailSubject1: string;
    emailSubject2: string;
    coldEmailShort: string;
    coldEmailMedium: string;
    followUp1: string;
    draftType: string;
    sequenceStep: number;
    approvalStatus: string;
    gmailSyncStatus: string;
    gmailThreadId?: string;
    sheetSyncStatus: string;
    assetPath?: string;
    diagnosticFormUrl?: string;
    contactEmail?: string;
  }>;
  engagementEvents: Array<{
    id: string;
    draftId: string;
    eventType: string;
    followUpCreated: boolean;
    occurredAtLabel: string;
  }>;
  linkedinTasks: Array<{
    id: string;
    contactName?: string;
    contactTitle?: string;
    lookupStatus: string;
    profileUrl?: string;
    connectionRequestNote: string;
    dmMessage: string;
    followUpDm: string;
  }>;
  diagnosticForms: Array<{
    id: string;
    formTitle: string;
    estimatedCompletionTime: string;
    industry: string;
    outreachCtaShort: string;
    googleFormUrl?: string;
    responseStatus: string;
    responseSummary?: Record<string, unknown>;
  }>;
};
