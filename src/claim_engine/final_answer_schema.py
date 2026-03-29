from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


FinalStance = Literal["support", "contradict", "neutral"]


class FinalEvidenceHighlight(BaseModel):
    source: str = Field(min_length=1)
    title: str = Field(min_length=1)
    stance: FinalStance
    excerpt: str = Field(min_length=1)


class FinalAnswerSummary(BaseModel):
    direct_answer: str = Field(min_length=1)
    reasoning_summary: str = Field(min_length=1)
    evidence_highlights: list[FinalEvidenceHighlight] = Field(default_factory=list, max_length=3)
    confidence_note: str = Field(min_length=1)

    def as_markdown(self) -> str:
        lines = [self.direct_answer.strip(), "", self.reasoning_summary.strip(), "", self.confidence_note.strip()]
        if self.evidence_highlights:
            lines.append("")
            lines.append("Top evidence:")
            for item in self.evidence_highlights:
                lines.append(f"- {item.source}: {item.title} ({item.stance})")
                lines.append(f"  {item.excerpt}")
        return "\n".join(lines).strip()
