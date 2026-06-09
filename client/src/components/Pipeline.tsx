import { useEffect, useState } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import { api } from '../api';
import type { Property } from '../types';
import { PIPELINE_STAGES, STAGE_COLOR, DEAL_TYPES } from '../types';
import Modal from './Modal';

// ─── Stage config ─────────────────────────────────────────────────────────────

interface StageConfig {
  name: string;
  color: string;
}

const COLOR_PALETTE = [
  '#64748b', '#3b82f6', '#8b5cf6', '#f59e0b', '#f97316',
  '#06b6d4', '#2d8653', '#94a3b8', '#ec4899', '#10b981',
];

function pickColor(existing: string[]): string {
  return COLOR_PALETTE.find(c => !existing.includes(c)) ?? COLOR_PALETTE[0];
}

const DEFAULT_STAGES: StageConfig[] = PIPELINE_STAGES.map(name => ({
  name,
  color: STAGE_COLOR[name] ?? '#64748b',
}));

// ─── Deal type badge styles ───────────────────────────────────────────────────

const DEAL_TYPE_STYLE: Record<string, { bg: string; text: string }> = {
  'For Sale':           { bg: '#E11D48', text: '#ffffff' },
  'To Let':             { bg: '#2563EB', text: '#ffffff' },
  'To Let / For Sale':  { bg: '#16A34A', text: '#ffffff' },
  'Lease':              { bg: '#2563EB', text: '#ffffff' },
  'Design & Build':     { bg: '#EA580C', text: '#ffffff' },
  'Under Offer':        { bg: '#7C3AED', text: '#ffffff' },
  'Owner Occupy':       { bg: '#0D9488', text: '#ffffff' },
  'Dead':               { bg: '#6B7280', text: '#ffffff' },
};

function getDtStyle(dealType: string) {
  return DEAL_TYPE_STYLE[dealType] ?? { bg: '#0D9488', text: '#ffffff' };
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtPsf(s: string): string {
  const n = parseFloat(s.replace(/[^\d.]/g, ''));
  if (isNaN(n)) return s;
  return n.toFixed(2);
}

function fmtInt(s: string): string {
  const n = Math.round(parseFloat(s.replace(/[^\d.]/g, '')));
  if (isNaN(n)) return s;
  return n.toLocaleString('en-GB');
}

function fmtSqFt(s: string): string {
  const n = parseInt(s.replace(/[^\d]/g, ''), 10);
  return isNaN(n) ? s : n.toLocaleString('en-GB');
}

function toStr(v: unknown): string {
  if (v == null) return '';
  return typeof v === 'string' ? v : String(v);
}

function sanitiseProp(p: import('../types').Property): import('../types').Property {
  return {
    id:             toStr(p.id),
    name:           toStr(p.name),
    location:       toStr(p.location),
    stage:          toStr(p.stage) || 'Identified',
    dealType:       toStr(p.dealType),
    sizeSqFt:       toStr(p.sizeSqFt),
    landlord:       toStr(p.landlord),
    rentPsf:        toStr(p.rentPsf),
    totalRentPa:    toStr(p.totalRentPa),
    estRatesPa:     toStr(p.estRatesPa),
    notes:          toStr(p.notes),
    lastContacted:  toStr(p.lastContacted),
    brochureUrl:    toStr(p.brochureUrl),
    mapUrl:         toStr(p.mapUrl),
    saleLetType:    toStr(p.saleLetType),
    capValuePsf:    toStr(p.capValuePsf),
    nextAction:      toStr(p.nextAction),
    nextActionDate:  toStr(p.nextActionDate),
    operatingProfit: toStr(p.operatingProfit),
  };
}

function daysAgo(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'today';
  if (diff === 1) return '1 day ago';
  if (diff < 0) return `in ${-diff} day${-diff !== 1 ? 's' : ''}`;
  return `${diff} days ago`;
}

function fmtShortDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Next action badge ────────────────────────────────────────────────────────

function nextActionBadge(action: string, dateStr: string) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const label = action.trim() || 'Follow-up';
  if (diff < 0)   return { text: `⚠️ ${label} — overdue`,                              cls: 'bg-red-100 text-red-700 border-red-200'     };
  if (diff === 0) return { text: `⚠️ ${label} — due today`,                            cls: 'bg-red-100 text-red-700 border-red-200'     };
  if (diff <= 7)  return { text: `📅 ${label} — in ${diff} day${diff !== 1 ? 's' : ''}`, cls: 'bg-amber-100 text-amber-700 border-amber-200' };
  return           { text: `📅 ${label}`,                                               cls: 'bg-green-100 text-green-700 border-green-200' };
}

// ─── Notes helpers ────────────────────────────────────────────────────────────

interface NoteEntry {
  id: string;
  text: string;
  timestamp: string;
  edited: boolean;
  auto?: boolean;
}

function fmtTimestamp(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${datePart}, ${timePart}`;
}

function parseNotes(raw: string): NoteEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as NoteEntry[];
  } catch {}
  // Legacy plain-text note — wrap it in a single entry
  return [{ id: '0', text: raw, timestamp: new Date().toISOString(), edited: false }];
}

function notesPreview(raw: string): string {
  if (!raw) return '';
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return (parsed[0] as NoteEntry).text;
  } catch {}
  return raw;
}

// ─── Property card ────────────────────────────────────────────────────────────

function PropertyCard({
  property,
  index,
  stageColor,
  isDead,
  onEdit,
  onDelete,
}: {
  property: Property;
  index: number;
  stageColor: string;
  isDead: boolean;
  onEdit: (p: Property) => void;
  onDelete: (id: string) => void;
}) {
  const dtStyle = getDtStyle(property.dealType);

  return (
    <Draggable draggableId={property.id} index={index}>
      {(prov, snap) => (
        <div
          ref={prov.innerRef}
          {...prov.draggableProps}
          {...prov.dragHandleProps}
          onClick={() => onEdit(property)}
          className={`flex overflow-hidden rounded-lg bg-white border border-slate-200 mb-2 cursor-pointer group transition-shadow
            ${snap.isDragging ? 'shadow-lg ring-2 ring-padel-green/30' : 'shadow-sm hover:shadow-md'}
            ${isDead ? 'opacity-60' : ''}
          `}
        >
          <div className="w-1 flex-shrink-0" style={{ backgroundColor: stageColor }} />
          <div className="flex-1 px-2.5 py-2 min-w-0">

            {/* Name + delete */}
            <div className="flex items-start justify-between gap-1">
              <p className="font-semibold text-xs text-slate-800 leading-snug">{property.name}</p>
              <button
                onClick={e => { e.stopPropagation(); onDelete(property.id); }}
                className="opacity-100 md:opacity-0 md:group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-400 text-lg leading-none flex-shrink-0 transition-opacity -mt-0.5"
                title="Delete"
              >×</button>
            </div>

            {/* Next action badge */}
            {(() => {
              const badge = nextActionBadge(property.nextAction, property.nextActionDate);
              return badge ? (
                <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.cls}`}>
                  {badge.text}
                </span>
              ) : null;
            })()}

            {/* Location */}
            {property.location && (
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                <span className="text-slate-300 mr-0.5">📍</span>{property.location}
              </p>
            )}

            {/* Deal type + size badges */}
            {(property.dealType || property.sizeSqFt) && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {property.dealType && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{ backgroundColor: dtStyle.bg, color: dtStyle.text }}
                  >
                    {property.dealType}
                  </span>
                )}
                {property.sizeSqFt && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-slate-200 bg-slate-50 text-slate-500">
                    {fmtSqFt(property.sizeSqFt)} sq ft
                  </span>
                )}
              </div>
            )}

            {/* Landlord */}
            {property.landlord && (
              <p className="text-[11px] text-slate-500 mt-1 truncate">
                <span className="text-slate-400">Landlord:</span> {property.landlord}
              </p>
            )}

            {/* Financials */}
            {(property.rentPsf || property.totalRentPa || property.operatingProfit) && (
              <div className="flex flex-wrap gap-x-3 mt-1">
                {property.rentPsf && (
                  <span className="text-[11px] text-slate-500">
                    <span className="text-slate-400">£</span>{fmtPsf(property.rentPsf)}<span className="text-slate-400"> psf</span>
                  </span>
                )}
                {property.totalRentPa && (
                  <span className="text-[11px] text-slate-500">
                    <span className="text-slate-400">£</span>{fmtInt(property.totalRentPa)}<span className="text-slate-400"> pa</span>
                  </span>
                )}
                {property.operatingProfit && (
                  <span className="text-[11px] text-slate-500">
                    <span className="text-slate-400">£</span>{fmtInt(property.operatingProfit)}<span className="text-slate-400"> op. profit</span>
                  </span>
                )}
              </div>
            )}

            {/* Last contacted */}
            {property.lastContacted && (
              <p className="text-[11px] text-slate-400 mt-1">
                <span className="mr-0.5">🗓</span>{daysAgo(property.lastContacted)}
              </p>
            )}


            {/* Link icons — only shown when URLs exist */}
            {(property.brochureUrl || property.mapUrl) && (
              <div className="flex items-center gap-1.5 mt-1.5">
                {property.brochureUrl && (
                  <button
                    onClick={e => { e.stopPropagation(); window.open(property.brochureUrl, '_blank', 'noopener'); }}
                    title="Open brochure"
                    className="w-6 h-6 flex items-center justify-center rounded transition-colors text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                )}
                {property.mapUrl && (
                  <button
                    onClick={e => { e.stopPropagation(); window.open(property.mapUrl, '_blank', 'noopener'); }}
                    title="Open map"
                    className="w-6 h-6 flex items-center justify-center rounded transition-colors text-green-600 hover:text-green-700 hover:bg-green-50"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </Draggable>
  );
}

// ─── Deal type manager ────────────────────────────────────────────────────────

function DealTypeManager({
  dealTypes,
  onUpdate,
}: {
  dealTypes: string[];
  onUpdate: (types: string[]) => void;
}) {
  const [newType, setNewType] = useState('');

  const add = () => {
    const t = newType.trim();
    if (!t || dealTypes.includes(t)) return;
    onUpdate([...dealTypes, t]);
    setNewType('');
  };

  return (
    <div className="border border-slate-200 rounded-lg p-2 space-y-1 bg-slate-50">
      {dealTypes.map(t => (
        <div key={t} className="flex items-center justify-between gap-1">
          <span className="text-xs text-slate-700 truncate">{t}</span>
          <button
            type="button"
            onClick={() => onUpdate(dealTypes.filter(x => x !== t))}
            className="flex-shrink-0 text-slate-300 hover:text-red-400 text-base leading-none transition-colors"
          >×</button>
        </div>
      ))}
      <div className="flex gap-1 pt-1 border-t border-slate-100">
        <input
          value={newType}
          onChange={e => setNewType(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Add type..."
          className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-padel-green focus:border-padel-green"
        />
        <button
          type="button"
          onClick={add}
          className="w-6 h-6 flex items-center justify-center bg-padel-green hover:bg-padel-green-dark text-white rounded text-sm transition-colors"
        >+</button>
      </div>
    </div>
  );
}

// ─── Notes timeline ───────────────────────────────────────────────────────────

function NotesTimeline({ value, onChange }: { value: string; onChange: (json: string) => void }) {
  const [entries,   setEntries]   = useState<NoteEntry[]>(() => parseNotes(value));
  const [newText,   setNewText]   = useState('');
  const [editId,    setEditId]    = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const commit = (next: NoteEntry[]) => { setEntries(next); onChange(JSON.stringify(next)); };

  const addNote = () => {
    const text = newText.trim();
    if (!text) return;
    commit([{ id: String(Date.now()), text, timestamp: new Date().toISOString(), edited: false }, ...entries]);
    setNewText('');
  };

  const deleteNote = (id: string) => commit(entries.filter(e => e.id !== id));
  const startEdit  = (e: NoteEntry) => { setEditId(e.id); setEditDraft(e.text); };
  const cancelEdit = () => { setEditId(null); setEditDraft(''); };
  const saveEdit   = (id: string) => {
    if (!editDraft.trim()) return;
    commit(entries.map(e => e.id === id ? { ...e, text: editDraft.trim(), edited: true } : e));
    setEditId(null);
  };

  const areaCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-padel-green focus:border-padel-green resize-none';

  return (
    <div>
      {/* New note input */}
      <div className="flex flex-col gap-2 mb-3">
        <textarea
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote(); }}
          rows={2}
          placeholder="Add a note..."
          className={areaCls}
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={addNote}
            disabled={!newText.trim()}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-padel-green hover:bg-padel-green-dark disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            Add Note
          </button>
        </div>
      </div>

      {/* Timeline */}
      {entries.length > 0 && (
        <div className="pl-4 border-l-2 border-slate-200 space-y-4">
          {entries.map(entry => (
            <div key={entry.id} className="relative group">
              <span className="absolute -left-[1.3rem] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-300 border-2 border-white block" />

              {editId === entry.id ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    value={editDraft}
                    onChange={e => setEditDraft(e.target.value)}
                    rows={3}
                    className={areaCls}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(entry.id)}
                      className="px-3 py-1 text-xs font-medium rounded-lg bg-padel-green hover:bg-padel-green-dark text-white transition-colors"
                    >Save</button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-3 py-1 text-xs font-medium rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
                    >Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className={`text-sm leading-relaxed whitespace-pre-wrap ${entry.auto ? 'text-slate-400 italic' : 'text-slate-700'}`}>{entry.text}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[11px] text-slate-400">{fmtTimestamp(entry.timestamp)}</span>
                    {entry.edited && <span className="text-[10px] text-slate-400 italic">· edited</span>}
                    {entry.auto && <span className="text-[10px] text-slate-300 font-medium uppercase tracking-wide">auto</span>}
                    <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => startEdit(entry)}
                        title="Edit note"
                        className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteNote(entry.id)}
                        title="Delete note"
                        className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-50 rounded transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Property form ─────────────────────────────────────────────────────────────

const EMPTY_PROPERTY: Omit<Property, 'id'> = {
  name: '', location: '', stage: 'Identified', dealType: '',
  sizeSqFt: '', landlord: '', rentPsf: '', totalRentPa: '', estRatesPa: '',
  notes: '', lastContacted: '', brochureUrl: '', mapUrl: '',
  saleLetType: '', capValuePsf: '',
  nextAction: '', nextActionDate: '', operatingProfit: '',
};

function computeTotalCapValue(capValuePsf: string, sizeSqFt: string): string {
  const psf  = parseFloat(capValuePsf.replace(/[^\d.]/g, ''));
  const sqft = parseFloat(sizeSqFt.replace(/[^\d.]/g, ''));
  if (isNaN(psf) || isNaN(sqft) || psf <= 0 || sqft <= 0) return '';
  return (psf * sqft).toLocaleString('en-GB', {
    style: 'currency', currency: 'GBP',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function PropertyForm({
  initial,
  stages,
  dealTypes,
  onSave,
  onCancel,
  onUpdateDealTypes,
}: {
  initial: Omit<Property, 'id'> & { id?: string };
  stages: StageConfig[];
  dealTypes: string[];
  onSave: (p: Omit<Property, 'id'> & { id?: string }) => void;
  onCancel: () => void;
  onUpdateDealTypes: (types: string[]) => void;
}) {
  const [form, setForm] = useState(initial);
  const [managingDealTypes, setManagingDealTypes] = useState(false);
  const [tickConfirm, setTickConfirm] = useState(false);

  const handleNotesChange = (json: string) => setForm(prev => ({ ...prev, notes: json }));

  const handleTickComplete = () => {
    const taskText = form.nextAction.trim();
    const autoNote: NoteEntry = {
      id: String(Date.now()),
      text: `Task completed: ${taskText}`,
      timestamp: new Date().toISOString(),
      edited: false,
      auto: true,
    };
    const existing = parseNotes(form.notes);
    const newNotes = JSON.stringify([autoNote, ...existing]);
    onSave({ ...form, nextAction: '', nextActionDate: '', notes: newNotes });
  };

  const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-3 md:py-2 text-sm focus:outline-none focus:ring-2 focus:ring-padel-green focus:border-padel-green';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setForm(prev => {
        const updated: typeof prev = { ...prev, [k]: value };
        if (k === 'rentPsf' || k === 'sizeSqFt') {
          const psf  = parseFloat((k === 'rentPsf'  ? value : prev.rentPsf).replace(/[^\d.]/g, ''));
          const sqft = parseFloat((k === 'sizeSqFt' ? value : prev.sizeSqFt).replace(/[^\d.]/g, ''));
          if (!isNaN(psf) && !isNaN(sqft) && psf > 0 && sqft > 0) {
            const total = psf * sqft;
            updated.totalRentPa = String(Math.round(total));
            updated.estRatesPa  = String(Math.round(total * 0.43));
          }
        }
        if (k === 'totalRentPa') {
          const total = parseFloat(value.replace(/[^\d.]/g, ''));
          if (!isNaN(total) && total > 0) {
            updated.estRatesPa = String(Math.round(total * 0.43));
          }
        }
        return updated;
      });
    };

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-3">

      <div>
        <label className={labelCls}>Property Name *</label>
        <input
          required
          value={form.name}
          onChange={set('name')}
          className={inputCls}
          placeholder="e.g. Tungsten unit"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Location</label>
          <input value={form.location} onChange={set('location')} className={inputCls} placeholder="e.g. Worcester" />
        </div>
        <div>
          <label className={labelCls}>Stage</label>
          <select value={form.stage} onChange={set('stage')} className={inputCls}>
            {stages.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-600">Deal Type</label>
            <button
              type="button"
              onClick={() => setManagingDealTypes(o => !o)}
              className="text-[10px] text-slate-400 hover:text-padel-green underline transition-colors"
            >
              {managingDealTypes ? 'Done' : 'Edit options'}
            </button>
          </div>
          {managingDealTypes ? (
            <DealTypeManager dealTypes={dealTypes} onUpdate={onUpdateDealTypes} />
          ) : (
            <select value={form.dealType} onChange={set('dealType')} className={inputCls}>
              <option value="">— Select —</option>
              {dealTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className={labelCls}>Size (sq ft)</label>
          <input value={form.sizeSqFt} onChange={set('sizeSqFt')} className={inputCls} placeholder="e.g. 15000" />
        </div>
      </div>

      <div>
        <label className={labelCls}>Landlord / Vendor</label>
        <input value={form.landlord} onChange={set('landlord')} className={inputCls} placeholder="e.g. Tungsten Property" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Rent psf (£)</label>
          <input
            value={form.rentPsf}
            onChange={set('rentPsf')}
            className={inputCls}
            placeholder="0.00"
            inputMode="decimal"
          />
        </div>
        <div>
          <label className={labelCls}>Total rent pa (£)</label>
          <input
            value={form.totalRentPa}
            onChange={set('totalRentPa')}
            className={inputCls}
            placeholder="auto"
            inputMode="decimal"
          />
        </div>
        <div>
          <label className={labelCls}>Est. rates pa (£)</label>
          <input
            value={form.estRatesPa}
            onChange={set('estRatesPa')}
            className={inputCls}
            placeholder="auto"
            inputMode="decimal"
          />
        </div>
      </div>

      <div className="md:w-1/3">
        <label className={labelCls}>Operating Profit (£)</label>
        <input
          value={form.operatingProfit}
          onChange={set('operatingProfit')}
          className={inputCls}
          placeholder="0.00"
          inputMode="decimal"
        />
      </div>

      {(['For Sale', 'To Let', 'To Let / For Sale', 'Design & Build'].includes(form.dealType)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Cap Value per sq ft (£)</label>
            <input
              value={form.capValuePsf}
              onChange={set('capValuePsf')}
              className={inputCls}
              placeholder="0.00"
              inputMode="decimal"
            />
          </div>
          <div>
            <label className={labelCls}>Total Cap Value</label>
            <input
              readOnly
              value={computeTotalCapValue(form.capValuePsf, form.sizeSqFt)}
              className={inputCls + ' bg-slate-50 text-slate-600 cursor-default'}
              placeholder="auto"
            />
          </div>
        </div>
      )}

      <div>
        <label className={labelCls}>Last Contacted</label>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={form.lastContacted}
            onChange={set('lastContacted')}
            className={inputCls}
          />
          {form.lastContacted && (
            <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
              {daysAgo(form.lastContacted)}
            </span>
          )}
        </div>
      </div>

      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Next Action</label>
            <input
              value={form.nextAction}
              onChange={e => { setTickConfirm(false); set('nextAction')(e); }}
              className={inputCls}
              placeholder="e.g. Chase re: deposit terms"
            />
          </div>
          <div>
            <label className={labelCls}>Next Action Date</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={form.nextActionDate}
                onChange={set('nextActionDate')}
                className={inputCls}
              />
              {form.nextActionDate && (() => {
                const badge = nextActionBadge(form.nextAction, form.nextActionDate);
                return badge ? (
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap flex-shrink-0 ${badge.cls}`}>
                    {badge.text}
                  </span>
                ) : null;
              })()}
            </div>
          </div>
        </div>

        {/* Tick-to-complete */}
        {form.nextAction.trim() && (
          <div className="mt-2">
            {!tickConfirm ? (
              <button
                type="button"
                onClick={() => setTickConfirm(true)}
                className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Mark as complete
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                <span className="text-xs text-emerald-700 flex-1">Mark as complete?</span>
                <button
                  type="button"
                  onClick={handleTickComplete}
                  className="text-xs font-semibold px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors"
                >Confirm</button>
                <button
                  type="button"
                  onClick={() => setTickConfirm(false)}
                  className="text-xs px-2.5 py-1 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
                >Cancel</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Brochure URL</label>
          <div className="flex gap-2 items-stretch">
            <input
              type="url"
              value={form.brochureUrl}
              onChange={set('brochureUrl')}
              className={inputCls + ' flex-1'}
              placeholder="https://drive.google.com/..."
            />
            {form.brochureUrl && (
              <a
                href={form.brochureUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open brochure"
                className="flex-shrink-0 w-10 flex items-center justify-center rounded-lg border border-blue-300 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-400 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </a>
            )}
          </div>
        </div>
        <div>
          <label className={labelCls}>Location Link</label>
          <div className="flex gap-2 items-stretch">
            <input
              type="url"
              value={form.mapUrl}
              onChange={set('mapUrl')}
              className={inputCls + ' flex-1'}
              placeholder="https://maps.google.com/..."
            />
            {form.mapUrl && (
              <a
                href={form.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open map"
                className="flex-shrink-0 w-10 flex items-center justify-center rounded-lg border border-green-300 bg-green-50 text-green-600 hover:bg-green-100 hover:border-green-400 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </a>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className={labelCls}>Notes</label>
        <NotesTimeline value={form.notes} onChange={handleNotesChange} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-3 md:py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-3 md:py-2 text-sm rounded-lg bg-padel-green hover:bg-padel-green-dark text-white font-medium transition-colors"
        >
          Save Property
        </button>
      </div>
    </form>
  );
}

// ─── Dashboard strip ──────────────────────────────────────────────────────────

const INACTIVE_STAGES = ['Dead', 'Withdrawn'];

function DashboardStrip({
  properties,
  onUpdateTask,
  onCompleteTask,
}: {
  properties: Property[];
  onUpdateTask: (id: string, nextAction: string, nextActionDate: string) => Promise<void>;
  onCompleteTask: (id: string, taskText: string) => Promise<void>;
}) {
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [draftAction,  setDraftAction]  = useState('');
  const [draftDate,    setDraftDate]    = useState('');
  const [tickConfirm,  setTickConfirm]  = useState(false);
  const [saving,       setSaving]       = useState(false);

  const liveCount = properties.filter(p => !INACTIVE_STAGES.includes(p.stage)).length;
  const openTasks = properties
    .filter(p => p.nextAction.trim())
    .sort((a, b) => {
      if (!a.nextActionDate && !b.nextActionDate) return 0;
      if (!a.nextActionDate) return 1;
      if (!b.nextActionDate) return -1;
      const [ay, am, ad] = a.nextActionDate.split('-').map(Number);
      const [by, bm, bd] = b.nextActionDate.split('-').map(Number);
      return new Date(ay, am - 1, ad).getTime() - new Date(by, bm - 1, bd).getTime();
    });

  const openRow = (p: Property) => {
    setExpandedId(p.id);
    setDraftAction(p.nextAction);
    setDraftDate(p.nextActionDate);
    setTickConfirm(false);
  };

  const closeRow = () => {
    setExpandedId(null);
    setDraftAction('');
    setDraftDate('');
    setTickConfirm(false);
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    try {
      await onUpdateTask(id, draftAction, draftDate);
      closeRow();
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (id: string) => {
    setSaving(true);
    try {
      await onCompleteTask(id, draftAction);
      closeRow();
    } finally {
      setSaving(false);
    }
  };

  const feedInputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-padel-green focus:border-padel-green';

  return (
    <div className="mx-4 md:mx-6 mb-1.5 flex flex-col sm:flex-row gap-1.5 items-start">

      {/* Stat cards */}
      <div className="flex gap-1.5 sm:flex-col sm:w-36 flex-shrink-0">
        <div className="flex-1 sm:flex-initial bg-white border border-slate-200 rounded-lg px-3 py-1.5 flex flex-col gap-0">
          <span className="text-xl font-bold text-slate-800 leading-tight tabular-nums">{liveCount}</span>
          <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wide leading-snug">Live Properties</span>
        </div>
        <div className="flex-1 sm:flex-initial bg-white border border-slate-200 rounded-lg px-3 py-1.5 flex flex-col gap-0">
          <span className="text-xl font-bold text-slate-800 leading-tight tabular-nums">{openTasks.length}</span>
          <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wide leading-snug">Open Tasks</span>
        </div>
      </div>

      {/* What Needs Doing feed */}
      <div className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 flex flex-col">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">What Needs Doing</p>
        {openTasks.length === 0 ? (
          <p className="text-xs text-slate-400">Nothing outstanding</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {openTasks.map(p => {
              const isExpanded = expandedId === p.id;

              if (isExpanded) {
                return (
                  <div key={p.id} className="py-3 first:pt-0 last:pb-0 space-y-2">

                    {/* Property name header */}
                    <p className="font-semibold text-xs text-slate-800">{p.name}</p>

                    {/* Editable fields */}
                    <input
                      autoFocus
                      value={draftAction}
                      onChange={e => { setDraftAction(e.target.value); setTickConfirm(false); }}
                      className={feedInputCls}
                      placeholder="Next action..."
                    />
                    <input
                      type="date"
                      value={draftDate}
                      onChange={e => setDraftDate(e.target.value)}
                      className={feedInputCls}
                    />

                    {/* Tick confirm */}
                    {tickConfirm ? (
                      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <span className="text-xs text-emerald-700 flex-1">Mark as complete?</span>
                        <button
                          type="button"
                          onClick={() => handleComplete(p.id)}
                          disabled={saving}
                          className="text-xs font-semibold px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors disabled:opacity-50"
                        >Confirm</button>
                        <button
                          type="button"
                          onClick={() => setTickConfirm(false)}
                          className="text-xs px-2.5 py-1 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
                        >Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSave(p.id)}
                          disabled={saving}
                          className="text-xs font-semibold px-3 py-1.5 bg-padel-green hover:bg-padel-green-dark text-white rounded-lg transition-colors disabled:opacity-50"
                        >{saving ? 'Saving…' : 'Save'}</button>
                        <button
                          type="button"
                          onClick={closeRow}
                          disabled={saving}
                          className="text-xs px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
                        >Cancel</button>
                        <button
                          type="button"
                          onClick={() => setTickConfirm(true)}
                          disabled={saving || !draftAction.trim()}
                          className="ml-auto inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Mark as complete"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          Complete
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={p.id}
                  onClick={() => openRow(p)}
                  className="flex items-baseline justify-between gap-3 py-1 first:pt-0 last:pb-0 cursor-pointer hover:bg-slate-50 -mx-1 px-1 rounded transition-colors"
                >
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="font-semibold text-xs text-slate-800 flex-shrink-0">{p.name}</span>
                    <span className="text-[11px] text-slate-400 truncate">{p.nextAction}</span>
                  </div>
                  {p.nextActionDate && (
                    <span className="text-[11px] text-slate-400 flex-shrink-0">{fmtShortDate(p.nextActionDate)}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Pipeline() {
  const [properties,    setProperties]    = useState<Property[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [stages,        setStages]        = useState<StageConfig[]>(DEFAULT_STAGES);
  const [editingStage,  setEditingStage]  = useState<{ name: string; draft: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [dealTypes,     setDealTypes]     = useState<string[]>([...DEAL_TYPES]);
  const [locations,     setLocations]     = useState<string[]>([]);
  const [locsOpen,      setLocsOpen]      = useState(true);
  const [newLoc,        setNewLoc]        = useState('');
  const [modal,         setModal]         = useState<
    { mode: 'add'; stage: string } | { mode: 'edit'; property: Property } | null
  >(null);

  useEffect(() => {
    api.pipeline.list()
      .then(props => setProperties(props.map(sanitiseProp)))
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));

    api.config.get('pipelineStages')
      .then(({ value }) => {
        if (!value) return;
        const parsed: unknown = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setStages(parsed as StageConfig[]);
        }
      })
      .catch(() => {});

    api.config.get('dealTypes')
      .then(({ value }) => {
        if (!value) return;
        const parsed: unknown = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDealTypes(parsed as string[]);
        }
      })
      .catch(() => {});

    api.config.get('targetLocations')
      .then(({ value }) => {
        if (value) {
          const parsed: unknown = JSON.parse(value);
          if (Array.isArray(parsed)) { setLocations(parsed as string[]); return; }
        }
        const defaults = ['Worcester', 'Cambridge'];
        setLocations(defaults);
        api.config.set('targetLocations', defaults).catch(() => {});
      })
      .catch(() => setLocations(['Worcester', 'Cambridge']));
  }, []);

  // ── Stage management ──────────────────────────────────────────────────────

  const saveStages = (s: StageConfig[]) =>
    api.config.set('pipelineStages', s).catch(() => {});

  const commitRename = () => {
    if (!editingStage) return;
    const { name: oldName, draft } = editingStage;
    const newName = draft.trim();
    setEditingStage(null);
    if (!newName || newName === oldName) return;
    if (stages.some(s => s.name === newName && s.name !== oldName)) return;
    const newStages = stages.map(s => s.name === oldName ? { ...s, name: newName } : s);
    setStages(newStages);
    saveStages(newStages);
    const affected = properties.filter(p => p.stage === oldName);
    if (affected.length > 0) {
      setProperties(prev => prev.map(p => p.stage === oldName ? { ...p, stage: newName } : p));
      affected.forEach(p =>
        api.pipeline.update(encodeURIComponent(p.id), { ...p, stage: newName }).catch(() => {})
      );
    }
  };

  const handleAddStage = () => {
    const existingColors = stages.map(s => s.color);
    const color = pickColor(existingColors);
    let name = 'New Stage';
    let n = 1;
    while (stages.some(s => s.name === name)) name = `New Stage ${n++}`;
    const newStages = [...stages, { name, color }];
    setStages(newStages);
    saveStages(newStages);
    setConfirmDelete(null);
    setEditingStage({ name, draft: name });
  };

  const handleDeleteStage = (stageName: string) => {
    const newStages = stages.filter(s => s.name !== stageName);
    setStages(newStages);
    saveStages(newStages);
    setConfirmDelete(null);
  };

  // ── Deal types ────────────────────────────────────────────────────────────

  const handleUpdateDealTypes = (types: string[]) => {
    setDealTypes(types);
    api.config.set('dealTypes', types).catch(() => {});
  };

  // ── Target locations ──────────────────────────────────────────────────────

  const addLocation = () => {
    const loc = newLoc.trim();
    if (!loc || locations.includes(loc)) { setNewLoc(''); return; }
    const updated = [...locations, loc];
    setLocations(updated);
    setNewLoc('');
    api.config.set('targetLocations', updated).catch(() => {});
  };

  const removeLocation = (loc: string) => {
    const updated = locations.filter(l => l !== loc);
    setLocations(updated);
    api.config.set('targetLocations', updated).catch(() => {});
  };

  // ── Property CRUD ─────────────────────────────────────────────────────────

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId: id, destination } = result;
    const newStage = destination.droppableId;
    const prop = properties.find(p => p.id === id);
    if (!prop || prop.stage === newStage) return;
    const updated = { ...prop, stage: newStage };
    setProperties(prev => prev.map(p => p.id === id ? updated : p));
    api.pipeline.update(encodeURIComponent(id), updated).catch(() =>
      setProperties(prev => prev.map(p => p.id === id ? prop : p))
    );
  };

  const handleSave = async (form: Omit<Property, 'id'> & { id?: string }) => {
    try {
      if (form.id) {
        const updated = await api.pipeline.update(encodeURIComponent(form.id), form as Property);
        setProperties(prev => prev.map(p => p.id === form.id ? updated : p));
      } else {
        const created = await api.pipeline.create(form);
        setProperties(prev => [...prev, created]);
      }
      setModal(null);
    } catch (e) {
      alert('Failed to save: ' + (e as Error).message);
    }
  };

  const handleUpdateTask = async (id: string, nextAction: string, nextActionDate: string) => {
    const prop = properties.find(p => p.id === id);
    if (!prop) return;
    const updated = sanitiseProp({ ...prop, nextAction, nextActionDate });
    await api.pipeline.update(encodeURIComponent(id), updated);
    setProperties(prev => prev.map(p => p.id === id ? updated : p));
  };

  const handleCompleteTask = async (id: string, taskText: string) => {
    const prop = properties.find(p => p.id === id);
    if (!prop) return;
    const autoNote: NoteEntry = {
      id: String(Date.now()),
      text: `Task completed: ${taskText}`,
      timestamp: new Date().toISOString(),
      edited: false,
      auto: true,
    };
    const newNotes = JSON.stringify([autoNote, ...parseNotes(prop.notes)]);
    const updated = sanitiseProp({ ...prop, nextAction: '', nextActionDate: '', notes: newNotes });
    await api.pipeline.update(encodeURIComponent(id), updated);
    setProperties(prev => prev.map(p => p.id === id ? updated : p));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this property?')) return;
    try {
      await api.pipeline.remove(encodeURIComponent(id));
      setProperties(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      alert('Failed to delete: ' + (e as Error).message);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
      Loading pipeline...
    </div>
  );
  if (error) return <div className="p-6 text-red-500 text-sm">Error: {error}</div>;

  const total = properties.length;
  const modalInitial = modal?.mode === 'edit'
    ? modal.property
    : { ...EMPTY_PROPERTY, stage: modal?.stage ?? stages[0]?.name ?? 'Identified' };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-1.5">
        <p className="text-xs text-slate-400 flex-1">
          {total} propert{total !== 1 ? 'ies' : 'y'} in pipeline
        </p>
        <button
          onClick={() => setModal({ mode: 'add', stage: stages[0]?.name ?? 'Identified' })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-padel-green hover:bg-padel-green-dark text-white text-xs font-medium rounded-lg transition-colors"
        >
          <span className="text-sm leading-none">+</span>
          <span className="hidden sm:inline">Add Property</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* ── Dashboard strip ── */}
      <DashboardStrip
        properties={properties}
        onUpdateTask={handleUpdateTask}
        onCompleteTask={handleCompleteTask}
      />

      {/* ── Target Locations Panel ── */}
      <div className="mx-4 md:mx-6 mb-1.5 bg-white border border-slate-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setLocsOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Target Locations
            </span>
            {locations.length > 0 && (
              <span className="bg-padel-green text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {locations.length}
              </span>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${locsOpen ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {locsOpen && (
          <div className="px-4 pb-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              {locations.map(loc => (
                <span
                  key={loc}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-padel-navy text-white text-xs font-medium rounded-full"
                >
                  {loc}
                  <button
                    onClick={() => removeLocation(loc)}
                    className="opacity-60 hover:opacity-100 leading-none"
                    title={`Remove ${loc}`}
                  >×</button>
                </span>
              ))}
              <div className="flex items-center gap-1.5">
                <input
                  value={newLoc}
                  onChange={e => setNewLoc(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addLocation()}
                  placeholder="Add location..."
                  className="text-xs border border-slate-200 rounded-full px-3 py-1 focus:outline-none focus:ring-1 focus:ring-padel-green focus:border-padel-green w-32"
                />
                <button
                  onClick={addLocation}
                  className="w-6 h-6 flex items-center justify-center bg-padel-green hover:bg-padel-green-dark text-white rounded-full text-sm leading-none transition-colors"
                  title="Add location"
                >+</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Kanban board ── */}
      <div className="flex-1 overflow-auto px-4 md:px-6 pb-2 min-h-0">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-2 h-full">

            {stages.map(stage => {
              const isDead      = stage.name === 'Dead';
              const stageProps  = properties.filter(p => p.stage === stage.name);
              const isEditing   = editingStage?.name === stage.name;
              const isDeleting  = confirmDelete === stage.name;

              return (
                <div key={stage.name} className="flex flex-col flex-1 min-w-[200px]">

                  {/* Column header */}
                  <div className="group flex items-center gap-1 mb-2 px-0.5 min-h-[24px]">

                    {isEditing ? (
                      <>
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                        <input
                          autoFocus
                          value={editingStage!.draft}
                          onChange={e => setEditingStage(prev => prev ? { ...prev, draft: e.target.value } : null)}
                          onKeyDown={e => {
                            if (e.key === 'Enter')  commitRename();
                            if (e.key === 'Escape') setEditingStage(null);
                          }}
                          onBlur={commitRename}
                          className="flex-1 min-w-0 text-xs font-semibold text-slate-700 bg-white border border-padel-green rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-padel-green/30"
                        />
                        <button onClick={commitRename} title="Confirm"
                          className="w-5 h-5 flex items-center justify-center text-padel-green hover:text-padel-green-dark flex-shrink-0">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button onClick={() => setEditingStage(null)} title="Cancel"
                          className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 flex-shrink-0">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>

                    ) : isDeleting ? (
                      <>
                        <span className="text-[11px] font-medium text-red-500 truncate flex-1">
                          Delete "{stage.name}"?
                        </span>
                        <button
                          onClick={() => handleDeleteStage(stage.name)}
                          className="text-[10px] font-semibold px-1.5 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded flex-shrink-0 transition-colors"
                        >Delete</button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-[10px] font-semibold px-1.5 py-0.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded flex-shrink-0 ml-0.5 transition-colors"
                        >Cancel</button>
                      </>

                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                        <span
                          className={`text-xs font-semibold truncate flex-1 cursor-pointer hover:text-padel-green transition-colors ${isDead ? 'text-slate-400' : 'text-slate-700'}`}
                          onClick={() => { setConfirmDelete(null); setEditingStage({ name: stage.name, draft: stage.name }); }}
                          title="Click to rename"
                        >
                          {stage.name}
                        </span>
                        <button
                          onClick={() => { setConfirmDelete(null); setEditingStage({ name: stage.name, draft: stage.name }); }}
                          title="Rename column"
                          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-slate-300 hover:text-padel-green transition-opacity flex-shrink-0"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => { setEditingStage(null); setConfirmDelete(stage.name); }}
                          title="Delete column"
                          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-slate-300 hover:text-red-400 transition-opacity flex-shrink-0"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <span className="flex-shrink-0 bg-slate-100 text-slate-500 text-[11px] font-semibold px-1.5 py-0.5 rounded-full">
                          {stageProps.length}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Column body */}
                  <Droppable droppableId={stage.name}>
                    {(provided, snapshot) => (
                      <div className={`flex flex-col flex-1 min-h-0 rounded-xl border transition-colors overflow-hidden ${
                        isDead
                          ? 'bg-slate-100 border-slate-200'
                          : snapshot.isDraggingOver
                            ? 'bg-padel-green/5 border-padel-green/30'
                            : 'bg-white border-slate-200'
                      }`}>
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="flex-1 overflow-y-auto p-2 min-h-[120px]"
                        >
                          {stageProps.map((prop, idx) => (
                            <PropertyCard
                              key={prop.id}
                              property={prop}
                              index={idx}
                              stageColor={stage.color}
                              isDead={isDead}
                              onEdit={p => setModal({ mode: 'edit', property: p })}
                              onDelete={handleDelete}
                            />
                          ))}
                          {provided.placeholder}
                        </div>
                        <button
                          onClick={() => setModal({ mode: 'add', stage: stage.name })}
                          className="flex-shrink-0 w-full flex items-center justify-center gap-1 py-2 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 border-t border-slate-100 transition-colors"
                        >
                          <span className="text-base leading-none">+</span> Add
                        </button>
                      </div>
                    )}
                  </Droppable>

                </div>
              );
            })}

            {/* Add column button */}
            <div className="flex flex-col flex-shrink-0 w-10 justify-start pt-0.5">
              <button
                onClick={handleAddStage}
                title="Add column"
                className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 hover:border-padel-green hover:text-padel-green text-slate-400 text-lg transition-colors"
              >+</button>
            </div>

          </div>
        </DragDropContext>
      </div>

      {/* ── Modal ── */}
      {modal && (
        <Modal
          title={modal.mode === 'edit' ? 'Edit Property' : `New Property — ${modal.stage}`}
          onClose={() => setModal(null)}
        >
          <PropertyForm
            initial={modalInitial}
            stages={stages}
            dealTypes={dealTypes}
            onSave={handleSave}
            onCancel={() => setModal(null)}
            onUpdateDealTypes={handleUpdateDealTypes}
          />
        </Modal>
      )}
    </div>
  );
}
