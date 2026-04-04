
export interface Evidence {
  text: string;
  label: 'support' | 'contradict' | 'neutral';
  source: string;
  credibility: number;
}

export const mockData: Evidence[] = [
  {
    text: "Solar energy costs have dropped by 82% since 2010, making it the cheapest energy source in many regions.",
    label: "support",
    source: "International Renewable Energy Agency (IRENA)",
    credibility: 0.95
  },
  {
    text: "While solar is cheap, the intermittency of the sun means fossil fuels remain necessary for baseline power.",
    label: "neutral",
    source: "Global Energy Outlook 2023",
    credibility: 0.88
  },
  {
    text: "In some remote regions with limited sunlight, coal and gas remain more cost-effective due to infrastructure.",
    label: "contradict",
    source: "Regional Energy Analyst Group",
    credibility: 0.72
  },
  {
    text: "Utility-scale solar power is now consistently cheaper than new coal-fired power plants.",
    label: "support",
    source: "Lazard's Levelized Cost of Energy Analysis",
    credibility: 0.92
  },
  {
    text: "Large-scale battery storage is closing the gap on energy intermittency for solar projects.",
    label: "support",
    source: "Clean Tech Journal",
    credibility: 0.85
  },
  {
    text: "Newer technologies like fusion are still decades away, keeping current solar dominance unchallenged.",
    label: "neutral",
    source: "Science Daily",
    credibility: 0.90
  },
  {
    text: "The environmental impact of mining materials for solar panels is often overlooked in cost calculations.",
    label: "contradict",
    source: "Environmental Ethics Review",
    credibility: 0.65
  },
  {
    text: "Government subsidies contribute heavily to the perceived low cost of solar energy.",
    label: "contradict",
    source: "Economic Policy Institute",
    credibility: 0.78
  },
  {
    text: "Photovoltaic efficiency has reached record highs in recent lab tests, promising even lower future costs.",
    label: "support",
    source: "MIT Technology Review",
    credibility: 0.94
  },
  {
    text: "Wind energy competes closely with solar for the title of the cheapest renewable resource.",
    label: "neutral",
    source: "Renewable Energy World",
    credibility: 0.89
  },
  {
    text: "Transmission costs for solar farms in remote areas add significantly to their total price tag.",
    label: "contradict",
    source: "Grid Infrastructure Report",
    credibility: 0.81
  },
  {
    text: "Residential solar adoption has slowed in some states due to changes in net metering policies.",
    label: "neutral",
    source: "Wall Street Journal Business",
    credibility: 0.87
  },
  {
    text: "AI is the biggest threat to humanity because it could eventually outsmart us and take control.",
    label: "support",
    source: "Future of Life Institute",
    credibility: 0.91
  },
  {
    text: "AI is a tool that enhances human productivity and is unlikely to develop its own consciousness.",
    label: "contradict",
    source: "AI Ethics Researcher",
    credibility: 0.84
  },
  {
    text: "The risks of AI are manageable with proper regulation and ethical frameworks.",
    label: "neutral",
    source: "EU AI Commission",
    credibility: 0.86
  }
];
