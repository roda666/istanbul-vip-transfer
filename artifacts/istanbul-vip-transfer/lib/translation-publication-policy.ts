export type TranslationPublicationCandidate = {
  entityType: string;
  status: string;
  sourceStatus: string;
  sourceIsActive: boolean;
  languageEnabled: boolean;
  languagePublished: boolean;
};

/** Shared policy guard for the bulk publisher; it never changes content. */
export function isEligibleServiceTranslation(row: TranslationPublicationCandidate): boolean {
  return row.entityType === 'service_page'
    && (row.status === 'APPROVED' || row.status === 'SCHEDULED')
    && row.sourceStatus === 'PUBLISHED'
    && row.sourceIsActive
    && row.languageEnabled
    && row.languagePublished;
}