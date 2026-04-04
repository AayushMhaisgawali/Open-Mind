import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { forceCollide } from 'd3-force';
import { X, Database, ToggleRight, ToggleLeft, Shield, ExternalLink } from 'lucide-react';

export interface DashboardGraphNode {
  id: string;
  group: 'person' | 'organization' | 'media' | 'government' | 'event';
  label: string;
  val: number;
  confidence: number;
  summary?: string;
  stance?: string;
  url?: string | null;
  domain?: string | null;
}

export interface DashboardGraphLink {
  source: string;
  target: string;
  label: string;
}

interface MindPixelsGraphProps {
  isProcessing: boolean;
  isActive: boolean;
  activeQuery?: string;
  graphData?: {
    nodes: DashboardGraphNode[];
    links: DashboardGraphLink[];
  };
}

const GROUP_COLOR: Record<DashboardGraphNode['group'], string> = {
  person: '#0ea5e9',
  organization: '#f97316',
  media: '#7c3aed',
  government: '#10b981',
  event: '#ef4444',
};

const TRACE_LEGEND_ITEMS = [
  { label: 'Start', color: GROUP_COLOR.event },
  { label: 'Website', color: GROUP_COLOR.organization },
  { label: 'Media Source', color: GROUP_COLOR.media },
  { label: 'Official Source', color: GROUP_COLOR.government },
  { label: 'Final Result', color: GROUP_COLOR.event },
] as const;

const FALLBACK_GRAPH = {
  nodes: [] as DashboardGraphNode[],
  links: [] as DashboardGraphLink[],
};

export const MindPixelsGraph: React.FC<MindPixelsGraphProps> = ({ isProcessing, isActive, graphData }) => {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 600 });
  const [hoverNode, setHoverNode] = useState<any>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<any>>(new Set());
  const [selectedNode, setSelectedNode] = useState<DashboardGraphNode | null>(null);
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [visibleCount, setVisibleCount] = useState(18);

  const data = useMemo(() => {
    const incoming = graphData && graphData.nodes.length > 0 ? graphData : FALLBACK_GRAPH;
    return {
      nodes: incoming.nodes,
      links: incoming.links,
    };
  }, [graphData]);

  useEffect(() => {
    setVisibleCount(Math.min(18, data.nodes.length || 18));
  }, [data.nodes.length]);

  useEffect(() => {
    let interval: number | undefined;
    if (isProcessing) {
      interval = window.setInterval(() => {
        setVisibleCount((prev) => Math.min(prev + 2, data.nodes.length));
      }, 180);
    } else {
      setVisibleCount(data.nodes.length);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [isProcessing, data.nodes.length]);

  const filteredData = useMemo(() => {
    const nodes = data.nodes.slice(0, visibleCount);
    const nodeIds = new Set(nodes.map((node) => node.id));
    const getLinkEndpointId = (endpoint: string | { id?: string }) =>
      typeof endpoint === 'object' && endpoint !== null ? String(endpoint.id || '') : String(endpoint);
    const links = data.links.filter((link) => {
      const sourceId = getLinkEndpointId(link.source as string | { id?: string });
      const targetId = getLinkEndpointId(link.target as string | { id?: string });
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });
    return { nodes, links };
  }, [data, visibleCount]);

  const positionedData = useMemo(() => {
    if (!filteredData.nodes.length || dimensions.width <= 0 || dimensions.height <= 0) {
      return filteredData;
    }

    const hashUnit = (value: string) => {
      let hash = 0;
      for (let i = 0; i < value.length; i += 1) {
        hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
      }
      return (hash % 1000) / 999;
    };

    const hashOffset = (value: string, range: number) => {
      return (hashUnit(value) - 0.5) * range;
    };

    const paddingX = 120;
    const paddingTop = 80;
    const paddingBottom = 70;
    const usableWidth = Math.max(dimensions.width - paddingX * 2, 240);
    const usableHeight = Math.max(dimensions.height - paddingTop - paddingBottom, 220);
    const count = filteredData.nodes.length;

    const nodes = filteredData.nodes.map((node, index) => {
      const progress = count <= 1 ? 0.5 : index / (count - 1);
      const jitterX = hashOffset(String(node.id), Math.min(110, usableWidth * 0.08));
      const jitterY = hashOffset(`${String(node.id)}-jitter-y`, Math.min(120, usableHeight * 0.18));
      const normalizedY = hashUnit(`${String(node.id)}-y`);
      const baseX = paddingX + usableWidth * progress;
      const baseY = paddingTop + usableHeight * (0.1 + normalizedY * 0.8);
      const x = Math.min(
        dimensions.width - paddingX,
        Math.max(paddingX, baseX + jitterX)
      );
      const y = Math.min(
        dimensions.height - paddingBottom,
        Math.max(paddingTop, baseY + jitterY)
      );
      return {
        ...node,
        x,
        y,
        fx: x,
        fy: y,
      };
    });

    return {
      nodes,
      links: filteredData.links,
    };
  }, [filteredData, dimensions.width, dimensions.height]);

  const handleNodeHover = useCallback((node: any) => {
    const nextNodes = new Set<string>();
    const nextLinks = new Set<any>();

    if (node) {
      nextNodes.add(node.id);
      data.links.forEach((link) => {
        if (String(link.source) === node.id || String(link.target) === node.id) {
          nextLinks.add(link);
          nextNodes.add(String(link.source));
          nextNodes.add(String(link.target));
        }
      });
    }

    setHoverNode(node);
    setHighlightNodes(nextNodes);
    setHighlightLinks(nextLinks);
  }, [data.links]);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });

    if (containerRef.current) observer.observe(containerRef.current);
    if (fgRef.current && isActive) {
      fgRef.current.d3Force('charge')?.strength(-20);
      fgRef.current.d3Force('collide', forceCollide().radius(12));
      fgRef.current.d3Force('link')?.distance(60);
    }

    return () => observer.disconnect();
  }, [isActive, positionedData.nodes.length]);

  useEffect(() => {
    if (!fgRef.current || !positionedData.nodes.length) return;
    const timer = window.setTimeout(() => {
      try {
        if (positionedData.nodes.length <= 2) {
          fgRef.current.centerAt(dimensions.width / 2, dimensions.height / 2, 250);
          fgRef.current.zoom(1, 250);
          return;
        }
        fgRef.current.centerAt(dimensions.width / 2, dimensions.height / 2, 250);
        fgRef.current.zoomToFit(350, 90);
        if (fgRef.current.zoom && fgRef.current.zoom() < 0.95) {
          fgRef.current.zoom(0.95, 250);
        }
      } catch {
        // Ignore zoom-to-fit timing issues while graph initializes.
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [positionedData.nodes.length, positionedData.links.length, dimensions.width, dimensions.height]);

  if (!isActive) return null;

  return (
    <div
      ref={containerRef}
      className="flex-1 h-full relative cursor-crosshair overflow-hidden bg-white"
      style={{
        backgroundImage: 'radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px)',
        backgroundSize: '30px 30px'
      }}
    >
      <div className="absolute top-6 right-6 z-[50] flex flex-col gap-3">
        <div className="bg-white/80 backdrop-blur-md px-5 py-3 rounded-[24px] border border-slate-100 shadow-xl shadow-slate-200/50 flex items-center gap-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Show Edge Labels</span>
          <button
            onClick={() => setShowEdgeLabels(!showEdgeLabels)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${showEdgeLabels ? 'text-blue-600 bg-blue-50' : 'text-slate-300 bg-slate-50'}`}
          >
            {showEdgeLabels ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
          </button>
        </div>
      </div>

      {filteredData.nodes.length > 0 && (
        <div className="absolute bottom-6 left-6 z-[50] bg-white/80 backdrop-blur-md p-5 rounded-[24px] border border-slate-100 shadow-xl shadow-slate-200/50 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-800">Trace Legend</span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {TRACE_LEGEND_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {dimensions.width > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={positionedData}
          nodeRelSize={1}
          nodeVal={(node: any) => node.val}
          nodeColor={(node: any) => {
            if (highlightNodes.size > 0 && !highlightNodes.has(node.id)) return '#f1f5f9';
            return GROUP_COLOR[node.group as DashboardGraphNode['group']];
          }}
          linkColor={(link: any) => {
            if (highlightLinks.size > 0 && !highlightLinks.has(link)) return '#f1f5f9';
            return '#cbd5e1';
          }}
          linkWidth={(link: any) => (highlightLinks.has(link) ? 2 : 1)}
          nodeCanvasObject={(node: any, ctx, globalScale) => {
            const isHighlighted = highlightNodes.has(node.id) || highlightNodes.size === 0;
            const isHovered = hoverNode?.id === node.id;
            const nodeSize = 9;

            if (isHovered || (isProcessing && node.id === 'claim')) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, nodeSize + 6, 0, 2 * Math.PI);
              ctx.fillStyle = GROUP_COLOR[node.group as DashboardGraphNode['group']] + '22';
              ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI, false);
            ctx.fillStyle = isHighlighted ? GROUP_COLOR[node.group as DashboardGraphNode['group']] : '#e2e8f0';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(node.x, node.y, 2.8, 0, 2 * Math.PI, false);
            ctx.fillStyle = isHighlighted ? '#ffffff' : '#f8fafc';
            ctx.fill();

            if (globalScale > 0.28 || isHovered) {
              const fontSize = Math.max(11, 12 / globalScale);
              ctx.font = `${isHovered ? '900' : '700'} ${fontSize}px "Inter", sans-serif`;
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.strokeStyle = 'white';
              ctx.lineWidth = Math.max(2.5, 3 / globalScale);
              ctx.strokeText(node.label, node.x + nodeSize + 4, node.y);
              ctx.fillStyle = isHighlighted ? '#1e293b' : '#94a3b8';
              ctx.fillText(node.label, node.x + nodeSize + 4, node.y);
            }
          }}
          linkCanvasObject={(link: any, ctx, globalScale) => {
            const isHighlighted = highlightLinks.has(link) || highlightLinks.size === 0;
            if (!isHighlighted && highlightLinks.size > 0) return;

            const start = link.source;
            const end = link.target;
            if (typeof start !== 'object' || typeof end !== 'object') return;

            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.strokeStyle = isHighlighted ? '#cbd5e1' : '#f1f5f9';
            ctx.lineWidth = (isHighlighted ? 1.5 : 1) / globalScale;
            ctx.stroke();

            if (showEdgeLabels && (globalScale > 0.8 || highlightLinks.has(link))) {
              const label = link.label;
              const x = start.x + (end.x - start.x) / 2;
              const y = start.y + (end.y - start.y) / 2;
              const fontSize = 8 / globalScale;
              ctx.font = `800 ${fontSize}px "Inter"`;
              const textWidth = ctx.measureText(label).width;
              ctx.save();
              ctx.translate(x, y);
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(-textWidth / 2 - 2, -fontSize / 2 - 2, textWidth + 4, fontSize + 4);
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = '#94a3b8';
              ctx.fillText(label, 0, 0);
              ctx.restore();
            }
          }}
          onNodeHover={handleNodeHover}
          onNodeClick={(node: any) => setSelectedNode(node as DashboardGraphNode)}
          cooldownTicks={0}
          d3AlphaDecay={1}
          d3VelocityDecay={1}
          nodeCanvasObjectMode={() => 'replace'}
          linkCanvasObjectMode={() => 'replace'}
        />
      )}

      {selectedNode && (
        <div className="absolute top-8 left-8 w-[400px] bg-white rounded-[32px] shadow-[0_32px_128px_-32px_rgba(0,0,0,0.15)] border border-slate-100 z-[100] animate-in fade-in slide-in-from-left-8 duration-500 overflow-hidden text-left">
          <div className="h-2" style={{ backgroundColor: GROUP_COLOR[selectedNode.group] }} />
          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-black text-slate-800">{selectedNode.label}</h3>
                <span className="px-3 py-1 rounded-full bg-slate-50 text-slate-500 text-[9px] font-black uppercase tracking-widest">{selectedNode.group}</span>
              </div>
              <button onClick={() => setSelectedNode(null)} className="w-10 h-10 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-400">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center">
                  <Database size={18} className="text-slate-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Graph Weight</p>
                  <p className="text-sm font-black text-slate-700">{Math.round(selectedNode.val)} Intelligence Points</p>
                </div>
              </div>

              <div className="flex items-center gap-5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50/50 flex items-center justify-center">
                  <Shield size={18} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Confidence</p>
                  <p className="text-sm font-black text-blue-600">{selectedNode.confidence}% certainty</p>
                </div>
              </div>

              {selectedNode.summary && (
                <div className="p-6 bg-slate-50/50 rounded-[24px] border border-slate-100">
                  <p className="text-xs leading-relaxed font-semibold text-slate-500">{selectedNode.summary}</p>
                </div>
              )}

              {selectedNode.url ? (
                <a
                  href={selectedNode.url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-4 rounded-[20px] bg-slate-900 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all inline-flex items-center justify-center gap-2"
                >
                  Open Source <ExternalLink size={14} />
                </a>
              ) : (
                <button className="w-full py-4 rounded-[20px] bg-slate-900 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all">
                  Trace Selected Node
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
