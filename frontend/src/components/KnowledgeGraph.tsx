import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

interface Entity {
  name: string;
  type: string;
  description: string;
}

interface Relationship {
  source: string;
  target: string;
  type: string;
}

interface KnowledgeGraphData {
  entities: Entity[];
  relationships: Relationship[];
}

interface KnowledgeGraphProps {
  data: KnowledgeGraphData;
}

// D3 specific types
interface D3Node extends d3.SimulationNodeDatum {
  name: string;
  type: string;
  description: string;
  x?: number;
  y?: number;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: D3Node;
  target: D3Node;
  type: string;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const getColorByType = (type: string): string => {
    const colors: { [key: string]: string } = {
      person: "#4299e1",
      organization: "#48bb78",
      concept: "#ed8936",
      default: "#a0aec0",
    };
    return colors[type.toLowerCase()] || colors.default;
  };

  useEffect(() => {
    if (!svgRef.current || !data.entities.length) return;

    const width = 800;
    const height = 600;

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    // Convert entities to D3Nodes
    const nodes: D3Node[] = data.entities.map((entity) => ({
      ...entity,
      x: undefined,
      y: undefined,
    }));

    // Create a map of entity names to nodes for quick lookup
    const nodeMap = new Map(nodes.map((node) => [node.name, node]));

    // Convert relationships to D3Links
    const links: D3Link[] = data.relationships.map((rel) => ({
      source: nodeMap.get(rel.source)!,
      target: nodeMap.get(rel.target)!,
      type: rel.type,
    }));

    // Create force simulation
    const simulation = d3
      .forceSimulation<D3Node>()
      .force(
        "link",
        d3.forceLink<D3Node, D3Link>().id((d: D3Node) => d.name)
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2));

    // Create arrow marker
    svg
      .append("defs")
      .selectAll("marker")
      .data(["arrow"])
      .join("marker")
      .attr("id", (d: string) => d)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 15)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#999")
      .attr("d", "M0,-5L10,0L0,5");

    // Create container for graph
    const container = svg.append("g");

    // Create links
    const link = container
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1)
      .attr("marker-end", "url(#arrow)");

    // Create nodes
    const node = container
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer");

    // Add circles to nodes
    node
      .append("circle")
      .attr("r", 5)
      .attr("fill", (d: D3Node) => getColorByType(d.type));

    // Add labels to nodes
    node
      .append("text")
      .attr("x", 8)
      .attr("y", "0.31em")
      .text((d: D3Node) => d.name)
      .clone(true)
      .lower()
      .attr("fill", "none")
      .attr("stroke", "white")
      .attr("stroke-width", 3);

    // Add tooltips
    node
      .append("title")
      .text((d: D3Node) => `${d.name}\nType: ${d.type}\n${d.description}`);

    // Update positions on simulation tick
    simulation.nodes(nodes).on("tick", () => {
      link
        .attr("x1", (d: D3Link) => d.source.x || 0)
        .attr("y1", (d: D3Link) => d.source.y || 0)
        .attr("x2", (d: D3Link) => d.target.x || 0)
        .attr("y2", (d: D3Link) => d.target.y || 0);

      node.attr(
        "transform",
        (d: D3Node) => `translate(${d.x || 0},${d.y || 0})`
      );
    });

    // Set link forces
    simulation.force<d3.ForceLink<D3Node, D3Link>>("link")?.links(links);

    // Add zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        container.attr("transform", event.transform.toString());
      });

    svg.call(zoom);

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [data]);

  return <svg ref={svgRef} />;
};

export default KnowledgeGraph;
