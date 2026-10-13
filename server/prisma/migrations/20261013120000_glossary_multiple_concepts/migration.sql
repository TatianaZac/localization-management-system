-- Один термін може мати кілька окремих понять із власними визначеннями.
DROP INDEX "GlossaryConcept_projectId_normalizedTerm_key";
CREATE INDEX "GlossaryConcept_projectId_normalizedTerm_idx"
ON "GlossaryConcept"("projectId", "normalizedTerm");
