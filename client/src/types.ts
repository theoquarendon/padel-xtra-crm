export type PipelineStage = string;

export const PIPELINE_STAGES: PipelineStage[] = [
  'Identified',
  'Brochure Sent',
  'Under Discussion',
  'Financials Sent',
  'Heads of Terms',
  'Legals',
  'Live',
  'Dead',
];

export const STAGE_COLOR: Record<string, string> = {
  'Identified':        '#64748b',
  'Brochure Sent':     '#3b82f6',
  'Under Discussion':  '#8b5cf6',
  'Financials Sent':   '#f59e0b',
  'Heads of Terms':    '#f97316',
  'Legals':            '#06b6d4',
  'Live':              '#2d8653',
  'Dead':              '#94a3b8',
};

export const DEAL_TYPES = ['Lease', 'Owner Occupy', 'Design & Build', 'To Let / For Sale'] as const;
export type DealType = typeof DEAL_TYPES[number];

export interface Property {
  id: string;
  name: string;
  location: string;
  stage: PipelineStage;
  dealType: string;
  sizeSqFt: string;
  landlord: string;
  rentPsf: string;
  totalRentPa: string;
  estRatesPa: string;
  notes: string;
  lastContacted: string;
  brochureUrl: string;
  mapUrl: string;
  saleLetType: string;
  capValuePsf: string;
}
