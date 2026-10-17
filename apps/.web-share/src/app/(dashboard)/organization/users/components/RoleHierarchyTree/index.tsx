'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  Panel,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserNode } from './nodes/UserNode';
import { HierarchyEdge } from './edges/HierarchyEdge';
import { transformToUserTreeData, getLevelBgColor } from './utils/transformData';
import { getLayoutedElements } from './utils/layoutTree';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { UserData, Role } from './types';

const nodeTypes = { user: UserNode };
const edgeTypes = { hierarchy: HierarchyEdge };

interface RoleHierarchyTreeProps {
  users: UserData[];
  roles: Role[];
  onUserClick?: (user: UserData) => void;
}

export function RoleHierarchyTree({ users, roles, onUserClick }: RoleHierarchyTreeProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleUserClick = useCallback(
    (user: UserData) => {
      if (onUserClick) {
        onUserClick(user);
      }
    },
    [onUserClick]
  );

  // Transform and layout data
  const initialData = useMemo(() => {
    const { nodes, edges } = transformToUserTreeData(roles, users, handleUserClick);
    return getLayoutedElements(nodes, edges, 'TB');
  }, [roles, users, handleUserClick]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.edges);

  // Update nodes when data changes
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = transformToUserTreeData(
      roles,
      users,
      handleUserClick
    );
    const { nodes: finalNodes, edges: finalEdges } = getLayoutedElements(newNodes, newEdges, 'TB');
    setNodes(finalNodes);
    setEdges(finalEdges);
  }, [roles, users, setNodes, setEdges, handleUserClick]);

  // Custom minimap node color
  const nodeColor = useCallback((node: Node) => {
    const level = (node.data as { level?: number })?.level ?? 9;
    return getLevelBgColor(level);
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  if (users.length === 0) {
    return (
      <Card className="h-[600px] flex items-center justify-center border-0 shadow-elegant-md">
        <div className="text-center text-muted-foreground">
          <p>No users available to display</p>
        </div>
      </Card>
    );
  }

  // Get unique role levels for legend
  const roleLevels = [...new Set(roles.map((r) => r.level))].sort((a, b) => a - b);
  const rolesByLevel = roles.reduce(
    (acc, role) => {
      if (!acc[role.level]) acc[role.level] = [];
      acc[role.level].push(role.name);
      return acc;
    },
    {} as Record<number, string[]>
  );

  const levelColors: Record<number, string> = {
    0: 'bg-purple-500',
    1: 'bg-blue-500',
    2: 'bg-green-500',
    3: 'bg-emerald-500',
    4: 'bg-amber-500',
    5: 'bg-orange-500',
    6: 'bg-cyan-500',
    7: 'bg-teal-500',
    8: 'bg-slate-500',
    9: 'bg-gray-500',
  };

  return (
    <Card
      className={`border-0 shadow-elegant-md overflow-hidden transition-all duration-300 ${
        isFullscreen ? 'fixed inset-4 z-50 h-auto' : 'h-[600px]'
      }`}
    >
      {/* Backdrop for fullscreen */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-black/50 -z-10" onClick={toggleFullscreen} />
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="hsl(var(--muted-foreground) / 0.2)"
        />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeColor="#666"
          nodeColor={nodeColor}
          maskColor="rgba(0, 0, 0, 0.1)"
          className="!bg-white/80 !border !border-border/50 !rounded-lg"
        />

        {/* Legend Panel */}
        <Panel
          position="top-left"
          className="bg-white/95 p-3 rounded-lg shadow-md border border-border/50 max-w-[200px]"
        >
          <h4 className="text-sm font-medium mb-2">Role Levels</h4>
          <div className="space-y-1 text-xs max-h-[200px] overflow-y-auto">
            {roleLevels.slice(0, 6).map((level) => (
              <div key={level} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded ${levelColors[level] || 'bg-gray-500'}`} />
                <span className="truncate">{rolesByLevel[level]?.join(', ')}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Actions Panel */}
        <Panel position="top-right" className="flex gap-2">
          <Button variant="outline" size="sm" onClick={toggleFullscreen} className="bg-white/95">
            {isFullscreen ? (
              <>
                <Minimize2 className="h-4 w-4 mr-1" />
                Exit Fullscreen
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4 mr-1" />
                Fullscreen
              </>
            )}
          </Button>
        </Panel>
      </ReactFlow>
    </Card>
  );
}

export type { UserData, Role } from './types';
