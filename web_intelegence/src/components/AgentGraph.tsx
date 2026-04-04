import React, { useCallback, useEffect, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { PipelineStep } from './Pipeline';

interface GraphNode {
  id: string;
  group: 'input' | 'agent' | 'source' | 'result';
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  label: string;
}

interface AgentGraphProps {
  currentStep: PipelineStep;
  onNodeSelect?: (nodeId: string | null) => void;
}

const NODE_COLORS: Record<GraphNode['group'], string> = {
  input: '#facc15',   // yellow
  agent: '#3b82f6',   // blue
  source: '#22c55e',  // green
  result: '#ef4444',  // red
};

const GLOW_COLORS: Record<GraphNode['group'], string> = {
  input: 'rgba(250,204,21,0.6)',
  agent: 'rgba(59,130,246,0.6)',
  source: 'rgba(34,197,94,0.6)',
  result: 'rgba(239,68,68,0.6)',
};

// Animation sequence: step → nodes to highlight
const STEP_HIGHLIGHT: Record<string, string[]> = {
  idle: [],
  query: ['User Query', 'Query Agent'],
  search: ['Query Agent', 'Search Agent', 'Retrieval Agent'],
  extract: ['Search Agent', 'Retrieval Agent', 'BBC', 'WHO', 'MIT', 'Reuters', 'CNN', 'GitHub', 'United Nations'],
  analyze: ['Evidence Agent', 'Scoring Agent'],
  result: ['Decision Agent', 'Final Conclusion'],
};

const BASE_DATA: { nodes: GraphNode[]; links: GraphLink[] } = {
  nodes: [
    { id: 'User Query', group: 'input' },
    { id: 'Query Agent', group: 'agent' },
    { id: 'Search Agent', group: 'agent' },
    { id: 'Retrieval Agent', group: 'agent' },
    { id: 'Evidence Agent', group: 'agent' },
    { id: 'Scoring Agent', group: 'agent' },
    { id: 'Decision Agent', group: 'agent' },
    { id: 'Final Conclusion', group: 'result' },
    // Sources
    { id: 'BBCNews', group: 'source' },
    { id: 'WHODatabase', group: 'source' },
    { id: 'MITAcademic', group: 'source' },
    { id: 'ReutersFeed', group: 'source' },
    { id: 'CNNWorld', group: 'source' },
    { id: 'GitHubOrg', group: 'source' },
    { id: 'UNReports', group: 'source' },
    { id: 'ScientificReview', group: 'source' },
    { id: 'EnergyAnalyst', group: 'source' },
    { id: 'IEAReport', group: 'source' },
  ],
  links: [
    { source: 'User Query', target: 'Query Agent', label: 'analyzes_intent' },
    { source: 'Query Agent', target: 'Search Agent', label: 'plans_investigation' },
    { source: 'Query Agent', target: 'Retrieval Agent', label: 'instructs_retrieval' },
    { source: 'Search Agent', target: 'BBCNews', label: 'extracts_from' },
    { source: 'Search Agent', target: 'WHODatabase', label: 'cross_references' },
    { source: 'Search Agent', target: 'MITAcademic', label: 'validates_methodology' },
    { source: 'Retrieval Agent', target: 'ReutersFeed', label: 'monitors_realtime' },
    { source: 'Retrieval Agent', target: 'CNNWorld', label: 'gathers_perspectives' },
    { source: 'Retrieval Agent', target: 'GitHubOrg', label: 'scrapes_data' },
    { source: 'Retrieval Agent', target: 'UNReports', label: 'consults_policy' },
    { source: 'BBCNews', target: 'Evidence Agent', label: 'supports_claim' },
    { source: 'WHODatabase', target: 'Evidence Agent', label: 'contradicts_claim' },
    { source: 'MITAcademic', target: 'Evidence Agent', label: 'provides_data' },
    { source: 'ReutersFeed', target: 'EnergyAnalyst', label: 'informs' },
    { source: 'EnergyAnalyst', target: 'IEAReport', label: 'cites' },
    { source: 'EnergyAnalyst', target: 'Evidence Agent', label: 'validates' },
    { source: 'ScientificReview', target: 'MITAcademic', label: 'peer_reviews' },
    { source: 'ScientificReview', target: 'Evidence Agent', label: 'verifies' },
    { source: 'Evidence Agent', target: 'Scoring Agent', label: 'compiles_metrics' },
    { source: 'Scoring Agent', target: 'Decision Agent', label: 'sets_confidence' },
    { source: 'Decision Agent', target: 'Final Conclusion', label: 'publishes_verdict' },
    // Cross-connections for density 
    { source: 'Search Agent', target: 'Retrieval Agent', label: 'syncs_parameters' },
    { source: 'WHODatabase', target: 'UNReports', label: 'shares_authority' },
    { source: 'MITAcademic', target: 'IEAReport', label: 'bases_findings' },
  ],
};

const LINK_COLORS: Record<string, string> = {
  supports_claim: 'rgba(34,197,94,0.3)',
  contradicts_claim: 'rgba(239,68,68,0.3)',
  verifies: 'rgba(34,197,94,0.3)',
  cross_references: 'rgba(99,102,241,0.3)',
  peer_reviews: 'rgba(168,85,247,0.3)',
  provides_data: 'rgba(20,184,166,0.3)',
  processed_by: 'rgba(59,130,246,0.2)',
  analyzes_intent: 'rgba(234,179,8,0.3)',
  publishes_verdict: 'rgba(239,68,68,0.5)',
};

export const AgentGraph: React.FC<AgentGraphProps> = ({ currentStep, onNodeSelect }) => {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 700, height: 500 });
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [showRelationships, setShowRelationships] = useState(true);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<string>>(new Set());

  // Responsive container size
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: Math.min(600, Math.max(450, entry.contentRect.width * 0.65)),
        });
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Sync highlights with pipeline step
  useEffect(() => {
    const nodes = new Set(STEP_HIGHLIGHT[currentStep] ?? []);
    setHighlightNodes(nodes);

    const links = new Set<string>();
    BASE_DATA.links.forEach((l) => {
      const src = typeof l.source === 'string' ? l.source : l.source.id!;
      const tgt = typeof l.target === 'string' ? l.target : l.target.id!;
      if (nodes.has(src) && nodes.has(tgt)) links.add(`${src}-${tgt}`);
    });
    setHighlightLinks(links);

    // Re-heat simulation on step change to show movement
    if (fgRef.current && currentStep !== 'idle') {
      fgRef.current.d3ReheatSimulation();
    }
  }, [currentStep]);

  // Configure Forces (Simple)
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge').strength(-400);
      fgRef.current.d3Force('link').distance(150);
    }
  }, [dimensions.height]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    if (selectedNode?.id === node.id) {
      setSelectedNode(null);
      if (onNodeSelect) onNodeSelect(null);
      setHighlightNodes(new Set(STEP_HIGHLIGHT[currentStep] ?? []));
      return;
    }
    setSelectedNode(node);
    if (onNodeSelect) onNodeSelect(node.id);
    const connected = new Set<string>([node.id]);
    BASE_DATA.links.forEach((l) => {
      const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id!;
      const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id!;
      if (src === node.id) connected.add(tgt);
      if (tgt === node.id) connected.add(src);
    });
    setHighlightNodes(connected);
  }, [selectedNode, currentStep, onNodeSelect]);

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node);
    if (containerRef.current) {
      containerRef.current.style.cursor = node ? 'pointer' : 'default';
    }
  }, []);

  const paintNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isHighlighted = highlightNodes.has(node.id!);
    const isHovered = hoveredNode?.id === node.id;
    const isSelected = selectedNode?.id === node.id;
    const color = NODE_COLORS[node.group];
    const glowColor = GLOW_COLORS[node.group];
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const r = isHovered || isSelected ? 14 : 10;

    // Glow / outer ring
    if (isHighlighted || isHovered || isSelected) {
      const gradient = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.5);
      gradient.addColorStop(0, glowColor);
      gradient.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(x, y, r * 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Outer ring pulse
    if (isHighlighted) {
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Main circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = isHighlighted ? 20 : 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Label
    const label = node.id!;
    const fontSize = Math.max(8, 11 / globalScale * 1.2);
    ctx.font = `bold ${fontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Label background
    const textWidth = ctx.measureText(label).width;
    const padding = 3;
    ctx.fillStyle = 'rgba(10,14,28,0.7)';
    ctx.fillRect(x - textWidth / 2 - padding, y + r + 3, textWidth + padding * 2, fontSize + padding * 2);

    ctx.fillStyle = isHighlighted ? '#ffffff' : '#cbd5e1';
    ctx.fillText(label, x, y + r + 3 + padding);
  }, [highlightNodes, hoveredNode, selectedNode]);

  const paintLink = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D) => {
    const src = link.source as GraphNode;
    const tgt = link.target as GraphNode;
    if (!src.x || !src.y || !tgt.x || !tgt.y) return;

    const linkKey = `${src.id}-${tgt.id}`;
    const isHighlighted = highlightLinks.has(linkKey);
    const color = LINK_COLORS[link.label] ?? 'rgba(148,163,184,0.3)';

    ctx.beginPath();
    // Curved links
    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const cx = (src.x + tgt.x) / 2 - dy * 0.2;
    const cy = (src.y + tgt.y) / 2 + dx * 0.2;
    ctx.moveTo(src.x, src.y);
    ctx.quadraticCurveTo(cx, cy, tgt.x, tgt.y);
    ctx.strokeStyle = isHighlighted ? color.replace(/[\d.]+\)$/, '0.9)') : color;
    ctx.lineWidth = isHighlighted ? 2.5 : 1;
    ctx.shadowColor = isHighlighted ? color : 'transparent';
    ctx.shadowBlur = isHighlighted ? 8 : 0;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Label on link
    if (showRelationships) {
      const lx = (src.x + 2 * cx + tgt.x) / 4;
      const ly = (src.y + 2 * cy + tgt.y) / 4;
      ctx.font = '7px Inter, sans-serif';
      ctx.fillStyle = isHighlighted ? '#94a3b8' : 'rgba(148,163,184,0.45)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(link.label, lx, ly);
    }
  }, [highlightLinks, showRelationships]);

  return (
    <div className="w-full space-y-4 mt-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400 font-semibold">Show Relationships</span>
          <button
            onClick={() => setShowRelationships(v => !v)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${showRelationships ? 'bg-blue-600' : 'bg-slate-700'}`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${showRelationships ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs font-bold">
          {(['input', 'agent', 'source', 'result'] as const).map(g => (
            <span key={g} className="flex items-center gap-1.5 uppercase tracking-widest" style={{ color: NODE_COLORS[g] }}>
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: NODE_COLORS[g], boxShadow: `0 0 8px ${NODE_COLORS[g]}` }} />
              {g === 'input' ? 'Query' : g === 'result' ? 'Conclusion' : g}
            </span>
          ))}
        </div>
      </div>

      {/* Graph Container */}
      <div
        ref={containerRef}
        className="w-full rounded-3xl overflow-hidden border border-white/10 bg-slate-900/40 relative shadow-2xl"
        style={{ height: dimensions.height }}
      >
        <ForceGraph2D
          ref={fgRef}
          graphData={BASE_DATA}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="transparent"
          nodeCanvasObject={paintNode as any}
          nodeCanvasObjectMode={() => 'replace'}
          linkCanvasObject={paintLink as any}
          linkCanvasObjectMode={() => 'replace'}
          onNodeClick={handleNodeClick as any}
          onNodeHover={handleNodeHover as any}
          nodeRelSize={10}
          linkDirectionalArrowLength={5}
          linkDirectionalArrowRelPos={1}
          linkDirectionalArrowColor={(link: any) => {
            const l = link.label as string;
            return LINK_COLORS[l] ?? 'rgba(148,163,184,0.5)';
          }}
          linkDirectionalParticles={4}
          linkDirectionalParticleWidth={(link: any) => {
            const src = typeof link.source === 'string' ? link.source : link.source.id;
            const tgt = typeof link.target === 'string' ? link.target : link.target.id;
            return highlightLinks.has(`${src}-${tgt}`) ? 3 : 0;
          }}
          linkDirectionalParticleColor={(link: any) => {
            const l = link.label as string;
            return LINK_COLORS[l] ?? '#94a3b8';
          }}
          cooldownTicks={80}
          d3AlphaDecay={0.04}
          d3VelocityDecay={0.25}
          warmupTicks={30}
          enableNodeDrag
          enableZoomInteraction
          enablePanInteraction
        />

        {/* Hovered node tooltip */}
        {hoveredNode && (
          <div
            className="absolute top-4 left-4 pointer-events-none px-4 py-2 rounded-xl border border-white/10 bg-slate-900/90 backdrop-blur-sm text-sm font-bold text-slate-200 shadow-xl"
            style={{ borderColor: NODE_COLORS[hoveredNode.group] + '55' }}
          >
            <span style={{ color: NODE_COLORS[hoveredNode.group] }}>● </span>
            {hoveredNode.id}
            <span className="ml-2 text-xs text-slate-500 capitalize font-medium">({hoveredNode.group})</span>
          </div>
        )}

        {/* Idle hint */}
        {currentStep === 'idle' && (
          <div className="absolute inset-0 flex items-end justify-center pb-8 pointer-events-none">
            <p className="text-xs text-slate-600 font-semibold uppercase tracking-widest animate-pulse">
              Run a query to animate the agent flow
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
