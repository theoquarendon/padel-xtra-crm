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

const STAGES: StageConfig[] = PIPELINE_STAGES.map(name => ({
  name,
  color: STAGE_COLOR[name] ?? '#64748b',
}));

// ─── Deal type badge styles ───────────────────────────────────────────────────

const DEAL_TYPE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  'Lease':          { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  'Owner Occupy':   { bg: '#dbeafe', text: '#1a2e4a', border: '#93c5fd' },
  'Design & Build': { bg: '#fef3c7', text: '#78350f', border: '#fcd34d' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(s: string): string {
  const n = parseInt(s.replace(/[^\d]/g, ''), 10);
  return isNaN(n) ? s : n.toLocaleString('en-GB');
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
  const dtStyle = DEAL_TYPE_STYLE[property.dealType];

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
              >
                ×
              </button>
            </div>

            {/* Location */}
            {property.location && (
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{property.location}</p>
            )}

            {/* Deal type + size badges */}
            {(property.dealType || property.sizeSqFt) && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {dtStyle && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                    style={{ backgroundColor: dtStyle.bg, color: dtStyle.text, borderColor: dtStyle.border }}
                  >
                    {property.dealType}
                  </span>
                )}
                {property.sizeSqFt && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-slate-200 bg-slate-50 text-slate-500">
                    {fmtNum(property.sizeSqFt)} sq ft
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
            {(property.rentPsf || property.totalRentPa) && (
              <div className="flex flex-wrap gap-x-3 mt-1">
                {property.rentPsf && (
                  <span className="text-[11px] text-slate-500">
                    <span className="text-slate-400">£</span>{fmtNum(property.rentPsf)}<span className="text-slate-400"> psf</span>
                  </span>
                )}
                {property.totalRentPa && (
                  <span className="text-[11px] text-slate-500">
                    <span className="text-slate-400">£</span>{fmtNum(property.totalRentPa)}<span className="text-slate-400"> pa</span>
                  </span>
                )}
              </div>
            )}

            {/* Notes */}
            {property.notes && (
              <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                {property.notes}
              </p>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}

// ─── Property form ─────────────────────────────────────────────────────────────

const EMPTY_PROPERTY: Omit<Property, 'id'> = {
  name: '', location: '', stage: 'Identified', dealType: '',
  sizeSqFt: '', landlord: '', rentPsf: '', totalRentPa: '', estRatesPa: '', notes: '',
};

function PropertyForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Omit<Property, 'id'> & { id?: string };
  onSave: (p: Omit<Property, 'id'> & { id?: string }) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-3 md:py-2 text-sm focus:outline-none focus:ring-2 focus:ring-padel-green focus:border-padel-green';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

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
            {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Deal Type</label>
          <select value={form.dealType} onChange={set('dealType')} className={inputCls}>
            <option value="">— Select —</option>
            {DEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Size (sq ft)</label>
          <input value={form.sizeSqFt} onChange={set('sizeSqFt')} className={inputCls} placeholder="e.g. 15,000" />
        </div>
      </div>

      <div>
        <label className={labelCls}>Landlord / Vendor</label>
        <input value={form.landlord} onChange={set('landlord')} className={inputCls} placeholder="e.g. Tungsten Property" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Rent psf (£)</label>
          <input value={form.rentPsf} onChange={set('rentPsf')} className={inputCls} placeholder="0" />
        </div>
        <div>
          <label className={labelCls}>Total rent pa (£)</label>
          <input value={form.totalRentPa} onChange={set('totalRentPa')} className={inputCls} placeholder="0" />
        </div>
        <div>
          <label className={labelCls}>Est. rates pa (£)</label>
          <input value={form.estRatesPa} onChange={set('estRatesPa')} className={inputCls} placeholder="0" />
        </div>
      </div>

      <div>
        <label className={labelCls}>Notes</label>
        <textarea
          value={form.notes}
          onChange={set('notes')}
          rows={3}
          className={inputCls + ' resize-none'}
          placeholder="Any relevant notes..."
        />
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function Pipeline() {
  const [properties,  setProperties]  = useState<Property[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [locations,   setLocations]   = useState<string[]>([]);
  const [locsOpen,    setLocsOpen]    = useState(true);
  const [newLoc,      setNewLoc]      = useState('');
  const [modal,       setModal]       = useState<
    { mode: 'add'; stage: string } | { mode: 'edit'; property: Property } | null
  >(null);

  useEffect(() => {
    api.pipeline.list()
      .then(setProperties)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));

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

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 md:px-6 pt-3 pb-2">
        <p className="text-xs text-slate-400 flex-1">
          {total} propert{total !== 1 ? 'ies' : 'y'} in pipeline
        </p>
        <button
          onClick={() => setModal({ mode: 'add', stage: 'Identified' })}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-padel-green hover:bg-padel-green-dark text-white text-sm font-medium rounded-lg transition-colors min-h-[44px]"
        >
          <span className="text-base leading-none">+</span>
          <span className="hidden sm:inline">Add Property</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* ── Target Locations Panel ── */}
      <div className="mx-4 md:mx-6 mb-3 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setLocsOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors"
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
                  >
                    ×
                  </button>
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
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Kanban board ── */}
      <div className="flex-1 overflow-auto px-4 md:px-6 pb-4 min-h-0">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-2 h-full">

            {STAGES.map(stage => {
              const isDead      = stage.name === 'Dead';
              const stageProps  = properties.filter(p => p.stage === stage.name);

              return (
                <div key={stage.name} className="flex flex-col flex-1 min-w-[200px]">

                  {/* Column header */}
                  <div className="flex items-center gap-1.5 mb-2 px-0.5 min-h-[24px]">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className={`text-xs font-semibold truncate flex-1 ${isDead ? 'text-slate-400' : 'text-slate-700'}`}>
                      {stage.name}
                    </span>
                    <span className="flex-shrink-0 bg-slate-100 text-slate-500 text-[11px] font-semibold px-1.5 py-0.5 rounded-full">
                      {stageProps.length}
                    </span>
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
            initial={modal.mode === 'edit' ? modal.property : { ...EMPTY_PROPERTY, stage: modal.stage }}
            onSave={handleSave}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
