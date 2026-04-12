import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from './useDatabase';
import { getAllNodes, createNode, updateNode, deleteNode, getNode, createLink, deleteLink, getLinksForNode } from '../db/database';
import type { Node, NodeInput, NodeLink } from '../types';

export function useNodes() {
  const { ready, version, refresh } = useDatabase();
  const [nodes, setNodes] = useState<Node[]>([]);

  useEffect(() => {
    if (ready) setNodes(getAllNodes());
  }, [ready, version]);

  const add = useCallback((input: NodeInput): Node => {
    const node = createNode(input);
    refresh();
    return node;
  }, [refresh]);

  const edit = useCallback((id: string, input: Partial<NodeInput>) => {
    updateNode(id, input);
    refresh();
  }, [refresh]);

  const remove = useCallback((id: string) => {
    deleteNode(id);
    refresh();
  }, [refresh]);

  const get = useCallback((id: string) => getNode(id), []);

  return { nodes, add, edit, remove, get };
}

export function useNodeLinks(nodeId: string | null) {
  const { ready, version, refresh } = useDatabase();
  const [links, setLinks] = useState<NodeLink[]>([]);

  useEffect(() => {
    if (ready && nodeId) setLinks(getLinksForNode(nodeId));
  }, [ready, version, nodeId]);

  const addLink = useCallback((targetId: string, linkType: 'parent' | 'lateral') => {
    if (!nodeId) return;
    createLink(nodeId, targetId, linkType);
    refresh();
  }, [nodeId, refresh]);

  const removeLink = useCallback((linkId: string) => {
    deleteLink(linkId);
    refresh();
  }, [refresh]);

  return { links, addLink, removeLink };
}
