'use client';

import { useAuth } from '@/components/context/AuthContext';
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  Zap, Plus, Trash2, Save, ChevronDown, ChevronRight,
  ToggleLeft, ToggleRight, Info, X,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL;

interface EventTypeMeta {
  name: string;
  description: string;
  available_variables: string[];
}

interface SubTaskTemplate {
  title: string;
  description: string;
  priority: string;
  assignee_emails: string[];
  due_date_offset_days: number;
  tags: string[];
}

interface TaskTemplate {
  template_id: string;
  title: string;
  description: string;
  priority: string;
  assignee_emails: string[];
  due_date_offset_days: number;
  tags: string[];
  on_complete_templates: SubTaskTemplate[];
}

interface TriggerRule {
  _id: string;
  event_type: string;
  is_active: boolean;
  task_templates: TaskTemplate[];
}

interface User {
  _id: string;
  name: string;
  email: string;
  department: string;
  status: string;
}

const PRIORITIES = ['urgent', 'high', 'medium', 'low'];
const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-red-500 dark:text-red-400',
  high: 'text-orange-500 dark:text-orange-400',
  medium: 'text-blue-500 dark:text-blue-400',
  low: 'text-gray-400 dark:text-zinc-500',
};

function emptySubTemplate(): SubTaskTemplate {
  return { title: '', description: '', priority: 'medium', assignee_emails: [], due_date_offset_days: 7, tags: [] };
}

function emptyTemplate(): TaskTemplate {
  return {
    template_id: crypto.randomUUID(),
    title: '',
    description: '',
    priority: 'medium',
    assignee_emails: [],
    due_date_offset_days: 7,
    tags: [],
    on_complete_templates: [],
  };
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('');
  const add = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) onChange([...tags, val]);
    setInput('');
  };
  return (
    <div className="flex flex-wrap gap-1 items-center border border-gray-300 dark:border-zinc-700 rounded-md px-2 py-1 min-h-[36px] focus-within:ring-1 focus-within:ring-blue-500 bg-white dark:bg-zinc-900">
      {tags.map(t => (
        <span key={t} className="flex items-center gap-0.5 bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-xs px-2 py-0.5 rounded-full">
          {t}
          <button type="button" onClick={() => onChange(tags.filter(x => x !== t))} className="ml-0.5 hover:text-red-500">
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
        }}
        onBlur={add}
        placeholder={tags.length === 0 ? 'Add tags…' : ''}
        className="flex-1 min-w-[80px] text-sm outline-none bg-transparent text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600"
      />
    </div>
  );
}

function SubTemplateRow({
  sub,
  users,
  onChange,
  onDelete,
}: {
  sub: SubTaskTemplate;
  users: User[];
  onChange: (s: SubTaskTemplate) => void;
  onDelete: () => void;
}) {
  const set = (field: keyof SubTaskTemplate, val: unknown) => onChange({ ...sub, [field]: val });
  return (
    <div className="border border-dashed border-gray-200 dark:border-zinc-700 rounded-lg p-3 space-y-2 bg-gray-50/50 dark:bg-zinc-800/40">
      <div className="flex items-center gap-2">
        <input
          value={sub.title}
          onChange={e => set('title', e.target.value)}
          placeholder="Follow-up task title *"
          className="flex-1 border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600"
        />
        <button type="button" onClick={onDelete} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 rounded text-gray-300 dark:text-zinc-600 shrink-0">
          <Trash2 size={13} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Priority</label>
          <select value={sub.priority} onChange={e => set('priority', e.target.value)}
            className="w-full border border-gray-300 dark:border-zinc-700 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100">
            {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Due (days after)</label>
          <input type="number" min={1} value={sub.due_date_offset_days}
            onChange={e => set('due_date_offset_days', parseInt(e.target.value) || 1)}
            className="w-full border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Assign to *</label>
          <div className="space-y-1">
            {sub.assignee_emails.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {sub.assignee_emails.map(email => {
                  const u = users.find(x => x.email === email);
                  return (
                    <span key={email} className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-700">
                      {u ? u.name : email}
                      <button type="button" onClick={() => set('assignee_emails', sub.assignee_emails.filter(e => e !== email))} className="hover:text-red-500 ml-0.5"><X size={10} /></button>
                    </span>
                  );
                })}
              </div>
            )}
            <select value="" onChange={e => { if (e.target.value && !sub.assignee_emails.includes(e.target.value)) set('assignee_emails', [...sub.assignee_emails, e.target.value]); }}
              className="w-full border border-gray-300 dark:border-zinc-700 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100">
              <option value="">+ Add assignee…</option>
              {users.filter(u => !sub.assignee_emails.includes(u.email)).map(u => (
                <option key={u._id} value={u.email}>{u.name} ({u.email})</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateRow({
  template,
  users,
  variables,
  onChange,
  onDelete,
  idx,
}: {
  template: TaskTemplate;
  users: User[];
  variables: string[];
  onChange: (t: TaskTemplate) => void;
  onDelete: () => void;
  idx: number;
}) {
  const [expanded, setExpanded] = useState(idx === 0);
  const set = (field: keyof TaskTemplate, val: unknown) =>
    onChange({ ...template, [field]: val });

  return (
    <div className="border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-lg transition-colors"
      >
        {expanded
          ? <ChevronDown size={14} className="text-gray-400 dark:text-zinc-500 shrink-0" />
          : <ChevronRight size={14} className="text-gray-400 dark:text-zinc-500 shrink-0" />}
        <span className="flex-1 text-sm font-medium text-gray-800 dark:text-zinc-200 truncate">
          {template.title || <span className="text-gray-400 dark:text-zinc-500 italic font-normal">Untitled task</span>}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 shrink-0 ${PRIORITY_COLORS[template.priority]}`}>
          {template.priority}
        </span>
        {template.assignee_emails.length > 0 && (
          <span className="text-xs text-gray-400 dark:text-zinc-500 truncate max-w-[180px] shrink-0 hidden sm:block">
            {template.assignee_emails.length === 1
              ? template.assignee_emails[0]
              : `${template.assignee_emails.length} assignees`}
          </span>
        )}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 rounded text-gray-300 dark:text-zinc-600 ml-1 shrink-0"
        >
          <Trash2 size={13} />
        </button>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-zinc-700 pt-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Title *</label>
            <input
              value={template.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Review PIS for {{brand}}"
              className="w-full border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Description</label>
            <textarea
              value={template.description}
              onChange={e => set('description', e.target.value)}
              rows={2}
              className="w-full border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Priority</label>
              <select
                value={template.priority}
                onChange={e => set('priority', e.target.value)}
                className="w-full border border-gray-300 dark:border-zinc-700 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100"
              >
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Due (days after)</label>
              <input
                type="number"
                min={1}
                value={template.due_date_offset_days}
                onChange={e => set('due_date_offset_days', parseInt(e.target.value) || 1)}
                className="w-full border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Assign to *</label>
              <div className="space-y-1.5">
                {template.assignee_emails.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {template.assignee_emails.map(email => {
                      const u = users.find(x => x.email === email);
                      return (
                        <span key={email} className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded-full border border-blue-200 dark:border-blue-700">
                          {u ? u.name : email}
                          <button
                            type="button"
                            onClick={() => set('assignee_emails', template.assignee_emails.filter(e => e !== email))}
                            className="hover:text-red-500 ml-0.5"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <select
                  value=""
                  onChange={e => {
                    if (e.target.value && !template.assignee_emails.includes(e.target.value)) {
                      set('assignee_emails', [...template.assignee_emails, e.target.value]);
                    }
                  }}
                  className="w-full border border-gray-300 dark:border-zinc-700 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100"
                >
                  <option value="">+ Add assignee…</option>
                  {users.filter(u => !template.assignee_emails.includes(u.email)).map(u => (
                    <option key={u._id} value={u.email}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Tags</label>
            <TagInput tags={template.tags} onChange={t => set('tags', t)} />
          </div>

          {/* On-completion chained tasks */}
          <div className="border-t border-gray-100 dark:border-zinc-700 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                On completion, also create
              </span>
              <button
                type="button"
                onClick={() => set('on_complete_templates', [...template.on_complete_templates, emptySubTemplate()])}
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
              >
                <Plus size={11} />
                Add follow-up task
              </button>
            </div>
            {template.on_complete_templates.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-zinc-600 italic">No follow-up tasks configured.</p>
            ) : (
              <div className="space-y-2">
                {template.on_complete_templates.map((sub, si) => (
                  <SubTemplateRow
                    key={si}
                    sub={sub}
                    users={users}
                    onChange={updated => set('on_complete_templates', template.on_complete_templates.map((s, i) => i === si ? updated : s))}
                    onDelete={() => set('on_complete_templates', template.on_complete_templates.filter((_, i) => i !== si))}
                  />
                ))}
              </div>
            )}
          </div>

          {variables.length > 0 && (
            <p className="text-xs text-gray-400 dark:text-zinc-500 flex items-center gap-1 flex-wrap">
              <Info size={11} className="shrink-0" />
              <span>Available variables:</span>
              {variables.map(v => (
                <code key={v} className="bg-gray-100 dark:bg-zinc-800 px-1 rounded text-gray-600 dark:text-zinc-300 font-mono">{`{{${v}}}`}</code>
              ))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function TaskTriggersPage() {
  const { accessToken, user } = useAuth();
  const [eventTypes, setEventTypes] = useState<Record<string, EventTypeMeta>>({});
  const [drafts, setDrafts] = useState<Record<string, TaskTemplate[]>>({});
  const [activeMap, setActiveMap] = useState<Record<string, boolean>>({});
  const [ruleIds, setRuleIds] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const headers = { Authorization: accessToken };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [etRes, rulesRes, usersRes] = await Promise.all([
        axios.get(`${API}/task-triggers/event-types`, { headers }),
        axios.get(`${API}/task-triggers/`, { headers }),
        axios.get(`${API}/users`, { headers }),
      ]);
      const et: Record<string, EventTypeMeta> = etRes.data;
      const ruleList: TriggerRule[] = rulesRes.data;
      const userList: User[] = (usersRes.data as User[]).filter(u => u.status === 'active');

      setEventTypes(et);
      setUsers(userList);

      const draftMap: Record<string, TaskTemplate[]> = {};
      const activeM: Record<string, boolean> = {};
      const ruleIdM: Record<string, string | null> = {};
      const expandedM: Record<string, boolean> = {};

      for (const evType of Object.keys(et)) {
        const rule = ruleList.find(r => r.event_type === evType);
        draftMap[evType] = rule ? rule.task_templates.map(t => ({
          ...t,
          // migrate legacy single assignee_email → assignee_emails array
          assignee_emails: t.assignee_emails?.length
            ? t.assignee_emails
            : (t as unknown as { assignee_email?: string }).assignee_email
              ? [(t as unknown as { assignee_email: string }).assignee_email]
              : [],
          on_complete_templates: (t.on_complete_templates ?? []).map(s => ({
            ...s,
            assignee_emails: s.assignee_emails ?? [],
          })),
        })) : [];
        activeM[evType] = rule?.is_active ?? false;
        ruleIdM[evType] = rule?._id ?? null;
        expandedM[evType] = true;
      }
      setDrafts(draftMap);
      setActiveMap(activeM);
      setRuleIds(ruleIdM);
      setExpandedCards(expandedM);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || 'Failed to load task triggers');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const updateTemplate = (evType: string, idx: number, tmpl: TaskTemplate) => {
    setDrafts(d => ({ ...d, [evType]: d[evType].map((t, i) => (i === idx ? tmpl : t)) }));
  };

  const addTemplate = (evType: string) => {
    setDrafts(d => ({ ...d, [evType]: [...(d[evType] ?? []), emptyTemplate()] }));
    setExpandedCards(e => ({ ...e, [evType]: true }));
  };

  const removeTemplate = (evType: string, idx: number) => {
    setDrafts(d => ({ ...d, [evType]: d[evType].filter((_, i) => i !== idx) }));
  };

  const save = async (evType: string) => {
    const templates = drafts[evType] ?? [];
    for (const t of templates) {
      if (!t.title.trim()) { toast.error('All task templates must have a title.'); return; }
      if (!t.assignee_emails.length) { toast.error('All task templates must have at least one assignee.'); return; }
    }
    setSaving(s => ({ ...s, [evType]: true }));
    try {
      const ruleId = ruleIds[evType];
      if (ruleId) {
        await axios.put(`${API}/task-triggers/${ruleId}`, { task_templates: templates }, { headers });
      } else {
        const res = await axios.post(`${API}/task-triggers/`, {
          event_type: evType,
          task_templates: templates,
        }, { headers });
        setRuleIds(m => ({ ...m, [evType]: res.data._id }));
        setActiveMap(m => ({ ...m, [evType]: true }));
      }
      toast.success('Changes saved');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(s => ({ ...s, [evType]: false }));
    }
  };

  const toggle = async (evType: string) => {
    const ruleId = ruleIds[evType];
    if (!ruleId) return;
    setToggling(t => ({ ...t, [evType]: true }));
    try {
      const res = await axios.patch(`${API}/task-triggers/${ruleId}/toggle`, {}, { headers });
      setActiveMap(m => ({ ...m, [evType]: res.data.is_active }));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Toggle failed');
    } finally {
      setToggling(t => ({ ...t, [evType]: false }));
    }
  };

  if (user && user.role !== 'admin') {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-zinc-500">
        You don&apos;t have permission to manage task triggers.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
          <Zap size={20} className="text-amber-500" />
          Task Triggers
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
          Configure tasks that are automatically created when specific events occur. Use{' '}
          <code className="bg-gray-100 dark:bg-zinc-800 px-1 rounded text-gray-700 dark:text-zinc-300 text-xs font-mono">{'{{variable}}'}</code>{' '}
          in titles and descriptions to include context from the triggering event.
        </p>
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-400 dark:text-zinc-500 text-sm">Loading…</div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400 mb-4">
          {error}
        </div>
      )}

      {!loading && !error && Object.entries(eventTypes).map(([evType, meta]) => {
        const templates = drafts[evType] ?? [];
        const isActive = activeMap[evType];
        const hasRule = !!ruleIds[evType];
        const isExpanded = expandedCards[evType];

        return (
          <div key={evType} className="border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 shadow-sm mb-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-zinc-800/60 border-b border-gray-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setExpandedCards(e => ({ ...e, [evType]: !e[evType] }))}
                className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-800 dark:text-zinc-200 text-sm">{meta.name}</span>
                  <span className="text-xs text-gray-400 dark:text-zinc-500 bg-gray-200 dark:bg-zinc-700 px-2 py-0.5 rounded-full font-mono">
                    {evType}
                  </span>
                  {hasRule && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                        : 'bg-gray-200 dark:bg-zinc-700 text-gray-500 dark:text-zinc-400'
                    }`}>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  )}
                  {!hasRule && (
                    <span className="text-xs text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-700 px-2 py-0.5 rounded-full">
                      Not configured
                    </span>
                  )}
                  {templates.length > 0 && (
                    <span className="text-xs text-gray-500 dark:text-zinc-400">
                      · {templates.length} task{templates.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{meta.description}</p>
              </div>

              {hasRule && (
                <button
                  type="button"
                  onClick={() => toggle(evType)}
                  disabled={toggling[evType]}
                  className="disabled:opacity-50 shrink-0"
                  title={isActive ? 'Disable trigger' : 'Enable trigger'}
                >
                  {isActive
                    ? <ToggleRight size={24} className="text-green-500 hover:text-green-600" />
                    : <ToggleLeft size={24} className="text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400" />}
                </button>
              )}
            </div>

            {/* Body */}
            {isExpanded && (
              <div className="p-4 space-y-3">
                {templates.length === 0 && (
                  <p className="text-sm text-gray-400 dark:text-zinc-500 italic text-center py-4">
                    No tasks configured for this event.
                  </p>
                )}

                {templates.map((tmpl, idx) => (
                  <TemplateRow
                    key={tmpl.template_id}
                    idx={idx}
                    template={tmpl}
                    users={users}
                    variables={meta.available_variables}
                    onChange={t => updateTemplate(evType, idx, t)}
                    onDelete={() => removeTemplate(evType, idx)}
                  />
                ))}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => addTemplate(evType)}
                    className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                  >
                    <Plus size={14} />
                    Add task template
                  </button>

                  <button
                    type="button"
                    onClick={() => save(evType)}
                    disabled={saving[evType]}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
                  >
                    <Save size={13} />
                    {saving[evType] ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
