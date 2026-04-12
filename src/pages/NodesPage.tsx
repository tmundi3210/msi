import { useState, useMemo } from 'react';
import { useNodes } from '../hooks/useNodes';
import { useCards } from '../hooks/useCards';
import { useDatabase } from '../hooks/useDatabase';
import { getNodesWithStats, getCardsWithScheduling, createCardsBulk, createLink, deleteLink, getLinksForNode } from '../db/database';
import { formatInterval } from '../srs/sm2';
import type { Node, CardType, NodeLink } from '../types';

export default function NodesPage() {
  const { nodes, add, edit, remove } = useNodes();
  const { version, refresh } = useDatabase();
  const [selected, setSelected] = useState<Node | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const nodesWithStats = useMemo(() => getNodesWithStats(), [version]);

  const filtered = useMemo(() => {
    if (!search.trim()) return nodesWithStats;
    const q = search.toLowerCase();
    return nodesWithStats.filter(ns =>
      ns.node.title.toLowerCase().includes(q) ||
      ns.node.definition.toLowerCase().includes(q)
    );
  }, [nodesWithStats, search]);

  return (
    <div>
      <div className="page-header">
        <h1>Knowledge Nodes</h1>
        <button className="btn-primary" onClick={() => { setSelected(null); setShowForm(true); }}>
          + New Node
        </button>
      </div>

      {nodes.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search nodes..."
            style={{ maxWidth: 400 }}
          />
        </div>
      )}

      {showForm && (
        <NodeForm
          initial={selected}
          nodes={nodes}
          onSave={(title, definition, parentId) => {
            if (selected) {
              edit(selected.id, { title, definition, parentId });
            } else {
              add({ title, definition, parentId });
            }
            setShowForm(false);
            setSelected(null);
          }}
          onCancel={() => { setShowForm(false); setSelected(null); }}
        />
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          {nodes.length === 0 ? (
            <>
              <h2>No nodes yet</h2>
              <p>Create your first knowledge node to start building your knowledge graph.</p>
            </>
          ) : (
            <>
              <h2>No matches</h2>
              <p>No nodes match "{search}"</p>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map(ns => (
            <NodeRow
              key={ns.node.id}
              nodeStats={ns}
              expanded={expandedId === ns.node.id}
              onToggle={() => setExpandedId(expandedId === ns.node.id ? null : ns.node.id)}
              onEdit={() => { setSelected(ns.node); setShowForm(true); }}
              onDelete={() => {
                if (confirm(`Delete "${ns.node.title}" and all its cards?`)) {
                  remove(ns.node.id);
                  if (expandedId === ns.node.id) setExpandedId(null);
                }
              }}
              allNodes={nodes}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NodeRow({ nodeStats, expanded, onToggle, onEdit, onDelete, allNodes, onRefresh }: {
  nodeStats: { node: Node; cardCount: number; dueCount: number; avgEase: number | null };
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  allNodes: Node[];
  onRefresh: () => void;
}) {
  const { node, cardCount, dueCount, avgEase } = nodeStats;

  // Recall health color based on avg ease factor
  const healthColor = avgEase === null ? 'var(--text-muted)'
    : avgEase >= 2.5 ? 'var(--recall-cold)'
    : avgEase >= 2.0 ? 'var(--recall-cool)'
    : avgEase >= 1.5 ? 'var(--recall-warm)'
    : 'var(--recall-hot)';

  return (
    <div className="card" style={{ borderLeft: `3px solid ${healthColor}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ cursor: 'pointer', flex: 1 }} onClick={onToggle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <strong>{node.title}</strong>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {cardCount} card{cardCount !== 1 ? 's' : ''}
            </span>
            {dueCount > 0 && (
              <span className="badge badge-due">{dueCount} due</span>
            )}
          </div>
          {node.definition && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              {node.definition.length > 150 ? node.definition.slice(0, 150) + '...' : node.definition}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 12, flexShrink: 0 }}>
          <button className="btn-ghost" onClick={onEdit}>Edit</button>
          <button className="btn-danger" onClick={onDelete}>Del</button>
        </div>
      </div>
      {expanded && <NodeDetail nodeId={node.id} allNodes={allNodes} onRefresh={onRefresh} />}
    </div>
  );
}

function NodeDetail({ nodeId, allNodes, onRefresh }: { nodeId: string; allNodes: Node[]; onRefresh: () => void }) {
  const { cards, add, remove } = useCards(nodeId);
  const { version } = useDatabase();
  const [tab, setTab] = useState<'cards' | 'bulk' | 'links'>('cards');

  const cardsWithSched = useMemo(() => getCardsWithScheduling(nodeId), [nodeId, version]);
  const links = useMemo(() => getLinksForNode(nodeId), [nodeId, version]);

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {(['cards', 'bulk', 'links'] as const).map(t => (
          <button
            key={t}
            className={tab === t ? 'btn-primary' : 'btn-ghost'}
            style={{ padding: '6px 14px', fontSize: 13 }}
            onClick={() => setTab(t)}
          >
            {t === 'cards' ? `Cards (${cards.length})` : t === 'bulk' ? 'Bulk Add' : `Links (${links.length})`}
          </button>
        ))}
      </div>

      {tab === 'cards' && <CardsTab nodeId={nodeId} cardsWithSched={cardsWithSched} add={add} remove={remove} />}
      {tab === 'bulk' && <BulkAddTab nodeId={nodeId} onDone={() => { onRefresh(); setTab('cards'); }} />}
      {tab === 'links' && <LinksTab nodeId={nodeId} links={links} allNodes={allNodes} onRefresh={onRefresh} />}
    </div>
  );
}

function CardsTab({ nodeId, cardsWithSched, add, remove }: {
  nodeId: string;
  cardsWithSched: Array<{ card: { id: string; cardType: string; front: string; back: string }; scheduling: { status: string; intervalDays: number; nextReviewAt: string } | null }>;
  add: (input: { nodeId: string; cardType: CardType; front: string; back: string }) => void;
  remove: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn-ghost" onClick={() => setShowForm(true)}>+ Add Card</button>
      </div>

      {showForm && (
        <CardForm
          onSave={(cardType, front, back) => {
            add({ nodeId, cardType, front, back });
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {cardsWithSched.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
          No cards yet. Add one above or use Bulk Add.
        </p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Front</th>
              <th>Status</th>
              <th>Interval</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cardsWithSched.map(({ card, scheduling }) => {
              const isDue = scheduling && new Date(scheduling.nextReviewAt) <= new Date();
              return (
                <tr key={card.id}>
                  <td><span className={`badge ${card.cardType === 'cloze' ? 'badge-new' : 'badge-good'}`}>{card.cardType}</span></td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {card.front}
                  </td>
                  <td>
                    {scheduling && (
                      <span style={{ color: isDue ? 'var(--recall-hot)' : 'var(--text-muted)', fontSize: 13 }}>
                        {isDue ? 'Due now' : scheduling.status}
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {scheduling ? formatInterval(scheduling.intervalDays) : '—'}
                  </td>
                  <td>
                    <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => { if (confirm('Delete?')) remove(card.id); }}>
                      Del
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

function BulkAddTab({ nodeId, onDone }: { nodeId: string; onDone: () => void }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Array<{ front: string; back: string }>>([]);

  const parse = (raw: string) => {
    const lines = raw.split('\n').filter(l => l.trim());
    const pairs: Array<{ front: string; back: string }> = [];
    for (const line of lines) {
      // Support "Q | A" or "Q -> A" or "Q ; A" or "Q\tA"
      const separators = [' | ', ' -> ', ' ; ', '\t'];
      let found = false;
      for (const sep of separators) {
        const idx = line.indexOf(sep);
        if (idx > 0) {
          pairs.push({ front: line.slice(0, idx).trim(), back: line.slice(idx + sep.length).trim() });
          found = true;
          break;
        }
      }
      if (!found && line.includes('?')) {
        // "What is X? The answer" — split on first ? followed by space
        const idx = line.indexOf('? ');
        if (idx > 0) {
          pairs.push({ front: line.slice(0, idx + 1).trim(), back: line.slice(idx + 2).trim() });
        }
      }
    }
    return pairs;
  };

  const handlePreview = () => {
    setPreview(parse(text));
  };

  const handleImport = () => {
    if (preview.length === 0) return;
    createCardsBulk(nodeId, preview.map(p => ({ cardType: 'qa' as const, front: p.front, back: p.back })));
    setText('');
    setPreview([]);
    onDone();
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
        Paste multiple cards. One per line. Separate Q and A with: <code>|</code>, <code>-&gt;</code>, <code>;</code>, or Tab.
      </p>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={`What is photosynthesis? | The process by which plants convert light into energy\nWhat is mitosis? | Cell division producing two identical daughter cells\nDNA stands for -> Deoxyribonucleic acid`}
        rows={8}
        style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn-ghost" onClick={handlePreview} disabled={!text.trim()}>
          Preview ({parse(text).length} cards)
        </button>
        {preview.length > 0 && (
          <button className="btn-primary" onClick={handleImport}>
            Import {preview.length} Cards
          </button>
        )}
      </div>

      {preview.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr><th>Front</th><th>Back</th></tr>
            </thead>
            <tbody>
              {preview.map((p, i) => (
                <tr key={i}>
                  <td>{p.front}</td>
                  <td>{p.back}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LinksTab({ nodeId, links, allNodes, onRefresh }: {
  nodeId: string;
  links: NodeLink[];
  allNodes: Node[];
  onRefresh: () => void;
}) {
  const [targetId, setTargetId] = useState('');

  const available = allNodes.filter(n =>
    n.id !== nodeId && !links.some(l => l.sourceId === n.id || l.targetId === n.id)
  );

  const handleAdd = () => {
    if (!targetId) return;
    createLink(nodeId, targetId, 'lateral');
    setTargetId('');
    onRefresh();
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <select value={targetId} onChange={e => setTargetId(e.target.value)} style={{ flex: 1 }}>
          <option value="">Link to another node...</option>
          {available.map(n => (
            <option key={n.id} value={n.id}>{n.title}</option>
          ))}
        </select>
        <button className="btn-primary" disabled={!targetId} onClick={handleAdd}>Link</button>
      </div>

      {links.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No links yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {links.map(l => {
            const otherId = l.sourceId === nodeId ? l.targetId : l.sourceId;
            const otherNode = allNodes.find(n => n.id === otherId);
            return (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, background: 'var(--bg-elevated)', borderRadius: 'var(--radius)' }}>
                <span>
                  <span className="badge badge-new" style={{ marginRight: 8 }}>{l.linkType}</span>
                  {otherNode?.title ?? 'Unknown'}
                </span>
                <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => { deleteLink(l.id); onRefresh(); }}>
                  Unlink
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NodeForm({ initial, nodes, onSave, onCancel }: {
  initial: Node | null;
  nodes: Node[];
  onSave: (title: string, definition: string, parentId: string | null) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [definition, setDefinition] = useState(initial?.definition ?? '');
  const [parentId, setParentId] = useState(initial?.parentId ?? '');

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{initial ? 'Edit Node' : 'New Knowledge Node'}</h2>
        <div className="form-group">
          <label>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Beta-Lactam Antibiotics" autoFocus />
        </div>
        <div className="form-group">
          <label>Definition</label>
          <textarea value={definition} onChange={e => setDefinition(e.target.value)} placeholder="Brief definition of this concept..." />
        </div>
        <div className="form-group">
          <label>Parent Node (optional)</label>
          <select value={parentId} onChange={e => setParentId(e.target.value)}>
            <option value="">None</option>
            {nodes.filter(n => n.id !== initial?.id).map(n => (
              <option key={n.id} value={n.id}>{n.title}</option>
            ))}
          </select>
        </div>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" disabled={!title.trim()} onClick={() => onSave(title.trim(), definition.trim(), parentId || null)}>
            {initial ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CardForm({ onSave, onCancel }: {
  onSave: (cardType: CardType, front: string, back: string) => void;
  onCancel: () => void;
}) {
  const [cardType, setCardType] = useState<CardType>('qa');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');

  return (
    <div className="card" style={{ marginBottom: 12, background: 'var(--bg-elevated)' }}>
      <div className="form-group">
        <label>Card Type</label>
        <select value={cardType} onChange={e => setCardType(e.target.value as CardType)}>
          <option value="qa">Q&A</option>
          <option value="cloze">Cloze</option>
        </select>
      </div>
      <div className="form-group">
        <label>{cardType === 'cloze' ? 'Text (use {{...}} for blanks)' : 'Question'}</label>
        <textarea
          value={front}
          onChange={e => setFront(e.target.value)}
          placeholder={cardType === 'cloze' ? 'The {{mitochondria}} is the powerhouse of the cell.' : 'What is the mechanism of action?'}
          autoFocus
        />
      </div>
      <div className="form-group">
        <label>{cardType === 'cloze' ? 'Answer (filled blank)' : 'Answer'}</label>
        <textarea value={back} onChange={e => setBack(e.target.value)} placeholder="Answer..." />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" disabled={!front.trim() || !back.trim()} onClick={() => {
          onSave(cardType, front.trim(), back.trim());
          setFront('');
          setBack('');
        }}>
          Add Card
        </button>
      </div>
    </div>
  );
}
