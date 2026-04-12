import { useState } from 'react';
import { useNodes } from '../hooks/useNodes';
import { useCards } from '../hooks/useCards';
import type { Node, CardType } from '../types';

export default function NodesPage() {
  const { nodes, add, edit, remove } = useNodes();
  const [selected, setSelected] = useState<Node | null>(null);
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="page-header">
        <h1>Knowledge Nodes</h1>
        <button className="btn-primary" onClick={() => { setSelected(null); setShowForm(true); }}>
          + New Node
        </button>
      </div>

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

      {nodes.length === 0 ? (
        <div className="empty-state">
          <h2>No nodes yet</h2>
          <p>Create your first knowledge node to start building your knowledge graph.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {nodes.map(node => (
            <NodeRow
              key={node.id}
              node={node}
              onEdit={() => { setSelected(node); setShowForm(true); }}
              onDelete={() => { if (confirm(`Delete "${node.title}" and all its cards?`)) remove(node.id); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NodeRow({ node, onEdit, onDelete }: { node: Node; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => setExpanded(e => !e)}>
          <strong>{node.title}</strong>
          {node.definition && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              {node.definition.length > 120 ? node.definition.slice(0, 120) + '...' : node.definition}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 12 }}>
          <button className="btn-ghost" onClick={onEdit}>Edit</button>
          <button className="btn-danger" onClick={onDelete}>Del</button>
        </div>
      </div>
      {expanded && <CardSection nodeId={node.id} />}
    </div>
  );
}

function CardSection({ nodeId }: { nodeId: string }) {
  const { cards, add, remove } = useCards(nodeId);
  const [showCardForm, setShowCardForm] = useState(false);

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)' }}>
          {cards.length} card{cards.length !== 1 ? 's' : ''}
        </span>
        <button className="btn-ghost" onClick={() => setShowCardForm(true)}>+ Add Card</button>
      </div>

      {showCardForm && (
        <CardForm
          nodeId={nodeId}
          onSave={(cardType, front, back) => {
            add({ nodeId, cardType, front, back });
            setShowCardForm(false);
          }}
          onCancel={() => setShowCardForm(false)}
        />
      )}

      {cards.map(c => (
        <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <span className={`badge ${c.cardType === 'cloze' ? 'badge-new' : 'badge-good'}`}>{c.cardType}</span>
            <span style={{ marginLeft: 8, fontSize: 14 }}>{c.front}</span>
          </div>
          <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => { if (confirm('Delete this card?')) remove(c.id); }}>
            Del
          </button>
        </div>
      ))}
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
  nodeId: string;
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
        />
      </div>
      <div className="form-group">
        <label>{cardType === 'cloze' ? 'Answer (filled blank)' : 'Answer'}</label>
        <textarea value={back} onChange={e => setBack(e.target.value)} placeholder="Answer..." />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" disabled={!front.trim() || !back.trim()} onClick={() => onSave(cardType, front.trim(), back.trim())}>
          Add Card
        </button>
      </div>
    </div>
  );
}
