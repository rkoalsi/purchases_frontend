'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '@/components/context/AuthContext';
import {
  Plus, X, MessageSquare, Paperclip, Trash2, Upload,
  Calendar, Tag, AlertCircle, Clock, CheckCircle2, Circle,
  ArrowRight, BarChart2, Search, RefreshCw, Download,
  FileText, Image, Archive, File, Loader2, Flag, Users,
  ChevronDown, ChevronUp, LayoutGrid, List,
  User, Edit2, Check, Building2, Eye, EyeOff,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Attachment {
  file_id: string; filename: string; content_type: string;
  size: number; uploaded_at: string; uploaded_by: string; uploaded_by_name: string;
}
interface Comment {
  comment_id: string; text: string;
  author_id: string; author_name: string; created_at: string;
}
interface ActivityEntry {
  activity_id: string; type: string; actor_id: string; actor_name: string;
  field?: string; old_value?: string; new_value?: string; detail?: string; timestamp: string;
}
interface Task {
  _id: string; title: string; description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'todo' | 'in_progress' | 'review' | 'done';
  assigned_to: string[]; assigned_to_names: string[];
  assigned_to_departments: string[];
  deadline?: string; tags: string[];
  created_by: string; created_by_name: string;
  creator_department?: string;
  is_hidden?: boolean;
  comments: Comment[]; attachments: Attachment[];
  activity: ActivityEntry[]; created_at: string; updated_at: string;
}
interface AppUser { _id: string; name: string; email: string; role: string; department?: string; permissions: string[] }
interface Stats {
  total: number; by_status: Record<string, number>; by_priority: Record<string, number>;
  by_department: Record<string, number>; overdue: number;
  by_assignee: { user_id: string; name: string; total: number; by_status: Record<string, number> }[];
  recent_activity: { activity: ActivityEntry; task_id: string; task_title: string }[];
}
type SortField = 'created_at' | 'updated_at' | 'deadline' | 'priority' | 'title';
type SortDir   = 'asc' | 'desc';
type ViewMode  = 'kanban' | 'list' | 'assignee' | 'department';

// ── Config ────────────────────────────────────────────────────────────────────

const PRIORITIES = [
  { value: 'urgent' as const, label: 'Urgent', border: 'border-l-red-500',    dot: 'bg-red-500',    badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',       color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50 dark:bg-red-900/20' },
  { value: 'high'   as const, label: 'High',   border: 'border-l-orange-500', dot: 'bg-orange-500', badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  { value: 'medium' as const, label: 'Medium', border: 'border-l-yellow-500', dot: 'bg-yellow-500', badge: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  { value: 'low'    as const, label: 'Low',    border: 'border-l-green-500',  dot: 'bg-green-500',  badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',   color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/20' },
];

const STATUSES = [
  { value: 'todo'        as const, label: 'To Do',       icon: Circle,       color: 'text-zinc-500 dark:text-zinc-400',       bg: 'bg-zinc-100 dark:bg-zinc-800',         header: 'bg-zinc-50 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700' },
  { value: 'in_progress' as const, label: 'In Progress', icon: Clock,        color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-900/20',       header: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' },
  { value: 'review'      as const, label: 'Review',      icon: ArrowRight,   color: 'text-purple-600 dark:text-purple-400',   bg: 'bg-purple-50 dark:bg-purple-900/20',   header: 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800' },
  { value: 'done'        as const, label: 'Done',        icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', header: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800' },
];

const ACTIVITY_ICONS: Record<string, string> = {
  created: '✦', status_changed: '↔', priority_changed: '⚑',
  comment_added: '💬', comment_deleted: '🗑',
  attachment_added: '📎', attachment_deleted: '🗑',
  title_changed: '✎', deadline_changed: '📅',
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

const getPriority = (v: string) => PRIORITIES.find((p) => p.value === v) ?? PRIORITIES[2];
const getStatus   = (v: string) => STATUSES.find((s) => s.value === v)   ?? STATUSES[0];

function taskForDepts(task: Task): string[] {
  const depts = [...new Set((task.assigned_to_departments ?? []).filter(Boolean))];
  return depts.length > 0 ? depts : (task.creator_department ? [task.creator_department] : []);
}

// Ensure bare ISO strings (no tz suffix) are treated as UTC, not local time
function asUTC(s: string): string {
  return s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s) ? s : s + 'Z';
}
function fmtDate(s?: string | null) {
  if (!s) return null;
  try { return new Date(asUTC(s)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return s; }
}
function fmtDateTime(s?: string) {
  if (!s) return '—';
  try { return new Date(asUTC(s)).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return s; }
}
function fmtRelative(s?: string) {
  if (!s) return '';
  const diff = Date.now() - new Date(asUTC(s)).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : (fmtDate(s) ?? s);
}
function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}
function isOverdue(deadline?: string, taskStatus?: string) {
  return !!(deadline && taskStatus !== 'done' && new Date(deadline) < new Date());
}
function fileIcon(ct: string) {
  if (ct.startsWith('image/')) return Image;
  if (ct === 'application/pdf') return FileText;
  if (ct.includes('zip') || ct.includes('archive')) return Archive;
  return File;
}

const AVATAR_COLORS = ['bg-blue-500','bg-violet-500','bg-emerald-500','bg-orange-500','bg-pink-500','bg-teal-500','bg-indigo-500','bg-rose-500'];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(name: string) { return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(); }

const DEPT_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/50',    text: 'text-blue-800 dark:text-blue-200',    icon: 'text-blue-600 dark:text-blue-300',    header: 'bg-blue-50 dark:bg-blue-900/20',    dot: 'bg-blue-500'    },
  { bg: 'bg-violet-100 dark:bg-violet-900/50', text: 'text-violet-800 dark:text-violet-200', icon: 'text-violet-600 dark:text-violet-300', header: 'bg-violet-50 dark:bg-violet-900/20', dot: 'bg-violet-500'  },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/50', text: 'text-emerald-800 dark:text-emerald-200', icon: 'text-emerald-600 dark:text-emerald-300', header: 'bg-emerald-50 dark:bg-emerald-900/20', dot: 'bg-emerald-500' },
  { bg: 'bg-orange-100 dark:bg-orange-900/50', text: 'text-orange-800 dark:text-orange-200', icon: 'text-orange-600 dark:text-orange-300', header: 'bg-orange-50 dark:bg-orange-900/20', dot: 'bg-orange-500'  },
  { bg: 'bg-pink-100 dark:bg-pink-900/50',    text: 'text-pink-800 dark:text-pink-200',    icon: 'text-pink-600 dark:text-pink-300',    header: 'bg-pink-50 dark:bg-pink-900/20',    dot: 'bg-pink-500'    },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/50',    text: 'text-cyan-800 dark:text-cyan-200',    icon: 'text-cyan-600 dark:text-cyan-300',    header: 'bg-cyan-50 dark:bg-cyan-900/20',    dot: 'bg-cyan-500'    },
  { bg: 'bg-amber-100 dark:bg-amber-900/50',  text: 'text-amber-800 dark:text-amber-200',  icon: 'text-amber-600 dark:text-amber-300',  header: 'bg-amber-50 dark:bg-amber-900/20',  dot: 'bg-amber-500'   },
  { bg: 'bg-rose-100 dark:bg-rose-900/50',    text: 'text-rose-800 dark:text-rose-200',    icon: 'text-rose-600 dark:text-rose-300',    header: 'bg-rose-50 dark:bg-rose-900/20',    dot: 'bg-rose-500'    },
];
const DEPT_COLOR_OVERRIDES: Record<string, number> = {
  'design':   1, // violet
  'accounts': 0, // blue
};
function deptColor(name: string) {
  const key = name.trim().toLowerCase();
  if (key in DEPT_COLOR_OVERRIDES) return DEPT_COLORS[DEPT_COLOR_OVERRIDES[key]];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return DEPT_COLORS[Math.abs(h) % DEPT_COLORS.length];
}

// ── Atoms ─────────────────────────────────────────────────────────────────────

function Avatar({ name, size = 'sm' }: { name: string; size?: 'xs' | 'sm' | 'md' }) {
  const sz = { xs: 'w-5 h-5 text-[9px]', sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm' }[size];
  return (
    <div className={`${sz} ${avatarColor(name)} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ring-2 ring-white dark:ring-zinc-900`} title={name}>
      {initials(name)}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const p = getPriority(priority);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${p.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />{p.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = getStatus(status);
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${s.bg} ${s.color}`}>
      <Icon className='w-3 h-3' />{s.label}
    </span>
  );
}

function AssigneeStack({ names, max = 3 }: { names: string[]; max?: number }) {
  const visible = names.slice(0, max);
  const rest = names.length - max;
  return (
    <div className='flex items-center'>
      {visible.map((name, i) => (
        <div key={name} className={i > 0 ? '-ml-2' : ''} style={{ zIndex: visible.length - i }}>
          <Avatar name={name} size='xs' />
        </div>
      ))}
      {rest > 0 && (
        <div className='-ml-2 w-5 h-5 rounded-full bg-zinc-300 dark:bg-zinc-600 flex items-center justify-center text-[9px] font-bold text-zinc-600 dark:text-zinc-300 ring-2 ring-white dark:ring-zinc-900'>
          +{rest}
        </div>
      )}
    </div>
  );
}

function DeptChip({ dept }: { dept: string }) {
  const c = deptColor(dept);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${c.bg} ${c.text}`}>
      <Building2 className={`w-2.5 h-2.5 flex-shrink-0 ${c.icon}`} />{dept}
    </span>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────────

function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const p = getPriority(task.priority);
  const overdue = isOverdue(task.deadline, task.status);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('taskId', task._id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable onDragStart={handleDragStart} onClick={onClick}
      className={`bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 border-l-4 ${p.border} p-3.5 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-150 group select-none`}
    >
      <div className='flex items-start justify-between gap-2 mb-2.5'>
        <PriorityBadge priority={task.priority} />
        <div className='flex items-center gap-1'>
          {task.is_hidden && (
            <span className='flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded'>
              <EyeOff className='w-2.5 h-2.5' /> Hidden
            </span>
          )}
          {overdue && (
            <span className='flex items-center gap-1 text-[10px] font-semibold text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded'>
              <AlertCircle className='w-2.5 h-2.5' /> Overdue
            </span>
          )}
        </div>
      </div>
      <h3 className='text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug'>
        {task.title}
      </h3>
      {task.description && (
        <p className='text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-2.5 leading-relaxed'>{task.description}</p>
      )}
      {taskForDepts(task).length > 0 && (
        <div className='flex flex-wrap gap-1 mb-2'>
          {taskForDepts(task).map((d) => <DeptChip key={d} dept={d} />)}
        </div>
      )}
      {task.tags.length > 0 && (
        <div className='flex flex-wrap gap-1 mb-2.5'>
          {task.tags.slice(0, 3).map((tag) => (
            <span key={tag} className='px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'>#{tag}</span>
          ))}
          {task.tags.length > 3 && <span className='text-[10px] text-zinc-400'>+{task.tags.length - 3}</span>}
        </div>
      )}
      <div className='flex items-center justify-between mt-auto pt-2 border-t border-zinc-100 dark:border-zinc-800'>
        <AssigneeStack names={task.assigned_to_names} />
        <div className='flex items-center gap-2.5 text-xs text-zinc-400'>
          {task.comments.length > 0 && <span className='flex items-center gap-0.5'><MessageSquare className='w-3 h-3' />{task.comments.length}</span>}
          {task.attachments.length > 0 && <span className='flex items-center gap-0.5'><Paperclip className='w-3 h-3' />{task.attachments.length}</span>}
          {task.deadline && (
            <span className={`flex items-center gap-0.5 text-[10px] font-medium ${overdue ? 'text-red-500' : 'text-zinc-400'}`}>
              <Calendar className='w-3 h-3' />{fmtDate(task.deadline)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanColumn({ statusDef, tasks, onTaskClick, onDrop, onAddTask }: {
  statusDef: typeof STATUSES[number]; tasks: Task[];
  onTaskClick: (t: Task) => void; onDrop: (taskId: string, newStatus: string) => void; onAddTask?: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const Icon = statusDef.icon;
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) onDrop(taskId, statusDef.value);
  };
  return (
    <div className='flex flex-col w-full'>
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3 border ${statusDef.header}`}>
        <Icon className={`w-4 h-4 ${statusDef.color}`} />
        <span className={`text-xs font-bold uppercase tracking-wide ${statusDef.color}`}>{statusDef.label}</span>
        <span className={`ml-1 text-xs font-bold ${statusDef.color} opacity-60 bg-white/50 dark:bg-black/20 px-1.5 py-0.5 rounded-full`}>{tasks.length}</span>
        {onAddTask && statusDef.value === 'todo' && (
          <button onClick={onAddTask} className='ml-auto p-0.5 rounded hover:bg-white/60 dark:hover:bg-black/20 transition-colors'>
            <Plus className={`w-3.5 h-3.5 ${statusDef.color}`} />
          </button>
        )}
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`space-y-2.5 flex-1 min-h-[200px] rounded-xl transition-all duration-150 p-1 -m-1 ${dragOver ? 'bg-blue-50 dark:bg-blue-900/10 ring-2 ring-blue-300 dark:ring-blue-700 ring-dashed' : ''}`}
      >
        {tasks.map((task) => <TaskCard key={task._id} task={task} onClick={() => onTaskClick(task)} />)}
        {tasks.length === 0 && (
          <div className={`flex items-center justify-center h-20 border-2 border-dashed rounded-xl transition-colors ${dragOver ? 'border-blue-300 dark:border-blue-600' : 'border-zinc-200 dark:border-zinc-800'}`}>
            <p className={`text-xs ${dragOver ? 'text-blue-400' : 'text-zinc-300 dark:text-zinc-600'}`}>{dragOver ? 'Drop here' : 'No tasks'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── List Row ──────────────────────────────────────────────────────────────────

function ListRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const overdue = isOverdue(task.deadline, task.status);
  return (
    <tr onClick={onClick} className='border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-blue-50/40 dark:hover:bg-zinc-800/30 cursor-pointer transition-colors group'>
      <td className='px-4 py-3 w-8'><div className={`w-1 h-8 rounded-full ${getPriority(task.priority).dot}`} /></td>
      <td className='px-2 py-3 max-w-[280px]'>
        <p className='font-medium text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate'>{task.title}</p>
        {taskForDepts(task).length > 0 && (
          <div className='flex flex-wrap gap-1 mt-0.5'>
            {taskForDepts(task).map((d) => <DeptChip key={d} dept={d} />)}
          </div>
        )}
      </td>
      <td className='px-4 py-3'><PriorityBadge priority={task.priority} /></td>
      <td className='px-4 py-3'>
        <div className='flex items-center gap-1'>
          <StatusBadge status={task.status} />
          {task.is_hidden && <span className='flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded'><EyeOff className='w-2.5 h-2.5' /> Hidden</span>}
        </div>
      </td>
      <td className='px-4 py-3'>
        {task.assigned_to_names.length > 0 ? (
          <div className='flex items-center gap-2'>
            <AssigneeStack names={task.assigned_to_names} max={3} />
            <span className='text-xs text-zinc-500 dark:text-zinc-400 hidden lg:block truncate max-w-[100px]'>
              {task.assigned_to_names.slice(0, 2).join(', ')}{task.assigned_to_names.length > 2 ? ` +${task.assigned_to_names.length - 2}` : ''}
            </span>
          </div>
        ) : <span className='text-xs text-zinc-300 dark:text-zinc-600 italic'>Unassigned</span>}
      </td>
      <td className='px-4 py-3'><span className={`text-xs font-medium ${overdue ? 'text-red-500' : 'text-zinc-500 dark:text-zinc-400'}`}>{fmtDate(task.deadline) ?? '—'}</span></td>
      <td className='px-4 py-3'><span className='text-xs text-zinc-400'>{fmtRelative(task.updated_at)}</span></td>
      <td className='px-4 py-3'>
        <div className='flex items-center gap-2 text-xs text-zinc-400'>
          {task.comments.length > 0 && <span className='flex items-center gap-0.5'><MessageSquare className='w-3 h-3' />{task.comments.length}</span>}
          {task.attachments.length > 0 && <span className='flex items-center gap-0.5'><Paperclip className='w-3 h-3' />{task.attachments.length}</span>}
        </div>
      </td>
    </tr>
  );
}

// ── Assignee View ─────────────────────────────────────────────────────────────

function AssigneeView({ tasks, users, onTaskClick }: { tasks: Task[]; users: AppUser[]; onTaskClick: (t: Task) => void }) {
  const groups = useMemo(() => {
    const map: Record<string, { user: AppUser | null; name: string; department?: string; tasks: Task[] }> = {};
    tasks.forEach((task) => {
      if (task.assigned_to.length === 0) {
        if (!map['__unassigned']) map['__unassigned'] = { user: null, name: 'Unassigned', tasks: [] };
        map['__unassigned'].tasks.push(task);
      } else {
        task.assigned_to.forEach((uid, idx) => {
          const name = task.assigned_to_names[idx] ?? uid;
          const userObj = users.find((u) => u._id === uid) ?? null;
          if (!map[uid]) map[uid] = { user: userObj, name, department: userObj?.department, tasks: [] };
          if (!map[uid].tasks.find((t) => t._id === task._id)) map[uid].tasks.push(task);
        });
      }
    });
    return Object.entries(map).sort(([a], [b]) => {
      if (a === '__unassigned') return 1;
      if (b === '__unassigned') return -1;
      const dA = map[a].department ?? '';
      const dB = map[b].department ?? '';
      return dA !== dB ? dA.localeCompare(dB) : map[a].name.localeCompare(map[b].name);
    });
  }, [tasks, users]);

  return (
    <div className='space-y-6'>
      {groups.map(([uid, group]) => {
        const byStatus = Object.fromEntries(STATUSES.map((s) => [s.value, group.tasks.filter((t) => t.status === s.value).length]));
        return (
          <div key={uid} className='bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden'>
            <div className='flex items-center gap-3 px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40'>
              {uid === '__unassigned'
                ? <div className='w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center'><User className='w-5 h-5 text-zinc-400' /></div>
                : <Avatar name={group.name} size='md' />}
              <div className='flex-1'>
                <p className='text-sm font-bold text-zinc-900 dark:text-zinc-100'>{group.name}</p>
                <div className='flex items-center gap-2'>
                  {group.user && <p className='text-xs text-zinc-400'>{group.user.email}</p>}
                  {group.department && (
                    <span className='flex items-center gap-1 text-[10px] font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 px-1.5 py-0.5 rounded'>
                      <Building2 className='w-2.5 h-2.5' />{group.department}
                    </span>
                  )}
                </div>
              </div>
              <div className='flex items-center gap-2 text-xs flex-wrap justify-end'>
                <span className='font-bold text-zinc-700 dark:text-zinc-200'>{group.tasks.length} tasks</span>
                {STATUSES.map((s) => byStatus[s.value] > 0 && (
                  <span key={s.value} className={`px-2 py-0.5 rounded-full font-semibold ${s.bg} ${s.color}`}>{byStatus[s.value]} {s.label}</span>
                ))}
              </div>
            </div>
            <div className='flex h-1'>
              {STATUSES.map((s) => {
                const pct = group.tasks.length ? (byStatus[s.value] / group.tasks.length) * 100 : 0;
                return pct > 0 ? (
                  <div key={s.value} style={{ width: `${pct}%` }} title={`${s.label}: ${byStatus[s.value]}`}
                    className={`${s.value==='todo'?'bg-zinc-200 dark:bg-zinc-700':s.value==='in_progress'?'bg-blue-400':s.value==='review'?'bg-purple-400':'bg-emerald-400'} transition-all`} />
                ) : null;
              })}
            </div>
            <div className='divide-y divide-zinc-100 dark:divide-zinc-800'>
              {group.tasks.map((task) => {
                const overdue = isOverdue(task.deadline, task.status);
                const p = getPriority(task.priority);
                return (
                  <div key={task._id} onClick={() => onTaskClick(task)}
                    className={`flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer group border-l-4 ${p.border} transition-colors`}>
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate'>{task.title}</p>
                      {taskForDepts(task).length > 0 && (
                        <span className='text-[10px] text-teal-500'>{taskForDepts(task).join(', ')}</span>
                      )}
                    </div>
                    <div className='flex items-center gap-2 flex-shrink-0'>
                      <PriorityBadge priority={task.priority} />
                      <StatusBadge status={task.status} />
                      {task.deadline && <span className={`text-xs font-medium ${overdue ? 'text-red-500' : 'text-zinc-400'}`}>{fmtDate(task.deadline)}</span>}
                      {task.comments.length > 0 && <span className='flex items-center gap-0.5 text-xs text-zinc-400'><MessageSquare className='w-3 h-3' />{task.comments.length}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {groups.length === 0 && (
        <div className='flex flex-col items-center justify-center py-24 text-zinc-400'>
          <Users className='w-10 h-10 mb-3 opacity-20' />
          <p className='text-sm'>No tasks found</p>
        </div>
      )}
    </div>
  );
}

// ── Department View ───────────────────────────────────────────────────────────

function DepartmentView({ tasks, onTaskClick }: { tasks: Task[]; onTaskClick: (t: Task) => void }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (dept: string) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(dept)) { next.delete(dept); } else { next.add(dept); }
    return next;
  });

  const groups = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach((task) => {
      const assignedDepts = (task.assigned_to_departments ?? []).filter(Boolean);
      const uniqueDepts = assignedDepts.length > 0
        ? [...new Set(assignedDepts)]
        : [task.creator_department || 'No Department'];
      uniqueDepts.forEach((dept) => {
        if (!map[dept]) map[dept] = [];
        if (!map[dept].find((t) => t._id === task._id)) map[dept].push(task);
      });
    });
    return Object.entries(map).sort(([a], [b]) => {
      if (a === 'No Department') return 1;
      if (b === 'No Department') return -1;
      return a.localeCompare(b);
    });
  }, [tasks]);

  const allDepts = groups.map(([d]) => d);
  const allCollapsed = allDepts.length > 0 && allDepts.every((d) => collapsed.has(d));

  return (
    <div className='space-y-3'>
      {/* Collapse / Expand All */}
      {groups.length > 1 && (
        <div className='flex justify-end'>
          <button
            onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(allDepts))}
            className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 rounded-lg transition-colors'
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${allCollapsed ? '' : 'rotate-180'}`} />
            {allCollapsed ? 'Expand All' : 'Collapse All'}
          </button>
        </div>
      )}

      {groups.map(([dept, deptTasks]) => {
        const dc = deptColor(dept);
        const isOpen = !collapsed.has(dept);
        const overdueCount = deptTasks.filter((t) => isOverdue(t.deadline, t.status)).length;
        // Group by status, sort tasks within each group by created_at desc
        const statusGroups = STATUSES
          .map((s) => ({
            ...s,
            tasks: deptTasks
              .filter((t) => t.status === s.value)
              .slice()
              .sort((a, b) => new Date(asUTC(b.created_at)).getTime() - new Date(asUTC(a.created_at)).getTime()),
          }))
          .filter((sg) => sg.tasks.length > 0);

        return (
          <div key={dept} className='bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm'>
            {/* Accordion header */}
            <button
              onClick={() => toggle(dept)}
              className={`w-full flex items-center gap-3 px-5 py-4 ${dc.header} hover:opacity-90 transition-opacity text-left`}
            >
              <div className={`w-8 h-8 rounded-lg ${dc.bg} flex items-center justify-center flex-shrink-0`}>
                <Building2 className={`w-4 h-4 ${dc.icon}`} />
              </div>
              <div className='flex-1 min-w-0'>
                <p className='text-sm font-bold text-zinc-900 dark:text-zinc-100'>{dept}</p>
                <p className={`text-xs font-medium ${dc.text}`}>{deptTasks.length} task{deptTasks.length !== 1 ? 's' : ''}</p>
              </div>
              <div className='flex items-center gap-1.5 flex-wrap justify-end'>
                {STATUSES.map((s) => {
                  const count = deptTasks.filter((t) => t.status === s.value).length;
                  return count > 0 ? (
                    <span key={s.value} className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.bg} ${s.color}`}>
                      {count} {s.label}
                    </span>
                  ) : null;
                })}
                {overdueCount > 0 && (
                  <span className='px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center gap-1'>
                    <AlertCircle className='w-2.5 h-2.5' />{overdueCount} Overdue
                  </span>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Accordion body */}
            {isOpen && (
              <div>
                {statusGroups.map((sg, si) => {
                  const SIcon = sg.icon;
                  return (
                    <div key={sg.value} className={si > 0 ? 'border-t border-zinc-100 dark:border-zinc-800' : ''}>
                      {/* Status section header */}
                      <div className={`flex items-center gap-2 px-5 py-2 ${sg.bg}`}>
                        <SIcon className={`w-3.5 h-3.5 ${sg.color}`} />
                        <span className={`text-xs font-bold uppercase tracking-wide ${sg.color}`}>{sg.label}</span>
                        <span className={`text-[10px] font-bold ${sg.color} opacity-60 bg-white/50 dark:bg-black/20 px-1.5 py-0.5 rounded-full`}>{sg.tasks.length}</span>
                      </div>
                      {/* Task rows */}
                      <div className='divide-y divide-zinc-50 dark:divide-zinc-800/50'>
                        {sg.tasks.map((task) => {
                          const overdue = isOverdue(task.deadline, task.status);
                          const p = getPriority(task.priority);
                          return (
                            <div key={task._id} onClick={() => onTaskClick(task)}
                              className={`flex items-center gap-3 px-5 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer group border-l-4 ${p.border} transition-colors`}>
                              <div className='flex-1 min-w-0'>
                                <p className='text-sm font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate'>{task.title}</p>
                                <div className='flex items-center gap-2 mt-0.5'>
                                  <span className={`text-[10px] font-semibold ${p.color}`}>{p.label}</span>
                                  {task.created_by_name && <span className='text-[10px] text-zinc-400'>by {task.created_by_name}</span>}
                                  <span className='text-[10px] text-zinc-300 dark:text-zinc-600'>·</span>
                                  <span className='text-[10px] text-zinc-400'>Created: {fmtDateTime(task.created_at)}</span>
                                </div>
                              </div>
                              <div className='flex items-center gap-2.5 flex-shrink-0'>
                                {task.assigned_to_names.length > 0 && <AssigneeStack names={task.assigned_to_names} max={3} />}
                                {task.comments.length > 0 && (
                                  <span className='flex items-center gap-0.5 text-[10px] text-zinc-400'><MessageSquare className='w-3 h-3' />{task.comments.length}</span>
                                )}
                                {task.attachments.length > 0 && (
                                  <span className='flex items-center gap-0.5 text-[10px] text-zinc-400'><Paperclip className='w-3 h-3' />{task.attachments.length}</span>
                                )}
                                {task.deadline && (
                                  <span className={`flex items-center gap-0.5 text-[10px] font-medium ${overdue ? 'text-red-500' : 'text-zinc-400'}`}>
                                    <Calendar className='w-3 h-3' />
                                    <span className='text-zinc-400 dark:text-zinc-500 mr-0.5'>Deadline:</span>{fmtDate(task.deadline)}
                                  </span>
                                )}
                                {overdue && (
                                  <span className='flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded'>
                                    <AlertCircle className='w-2.5 h-2.5' />Overdue
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {statusGroups.length === 0 && (
                  <p className='text-xs text-zinc-400 italic text-center py-6'>No tasks</p>
                )}
              </div>
            )}
          </div>
        );
      })}
      {groups.length === 0 && (
        <div className='flex flex-col items-center justify-center py-24 text-zinc-400'>
          <Building2 className='w-10 h-10 mb-3 opacity-20' />
          <p className='text-sm'>No tasks found</p>
        </div>
      )}
    </div>
  );
}

// ── Activity Feed ─────────────────────────────────────────────────────────────

function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  if (!entries || entries.length === 0) return <p className='text-xs text-zinc-400 italic text-center py-4'>No activity yet.</p>;
  return (
    <div className='space-y-3'>
      {[...entries].reverse().map((e) => (
        <div key={e.activity_id} className='flex gap-2.5'>
          <div className='flex-shrink-0 w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] mt-0.5'>
            {ACTIVITY_ICONS[e.type] ?? '·'}
          </div>
          <div className='flex-1 min-w-0'>
            <p className='text-xs text-zinc-700 dark:text-zinc-300 leading-snug'>
              <span className='font-semibold'>{e.actor_name}</span>{' '}
              {e.type === 'created' && 'created this task'}
              {e.type === 'comment_added' && <><span> commented: </span><span className='italic text-zinc-500 dark:text-zinc-400'>"{e.detail}"</span></>}
              {e.type === 'comment_deleted' && 'deleted a comment'}
              {e.type === 'attachment_added' && <><span> attached </span><span className='font-medium'>{e.detail}</span></>}
              {e.type === 'attachment_deleted' && <><span> removed </span><span className='font-medium'>{e.detail}</span></>}
              {(e.type.endsWith('_changed') && e.field) && (
                <><span> changed </span><span className='font-medium'>{e.field}</span><span> from </span>
                  <span className='line-through text-zinc-400'>{e.old_value}</span><span> to </span>
                  <span className='font-medium text-zinc-800 dark:text-zinc-200'>{e.new_value}</span></>
              )}
            </p>
            <p className='text-[10px] text-zinc-400 mt-0.5'>{fmtRelative(e.timestamp)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Stats Panel ───────────────────────────────────────────────────────────────

function StatsPanel({ stats }: { stats: Stats }) {
  const [open, setOpen] = useState(false);

  const kpis = [
    { label: 'Total',       value: stats.total,                         color: 'text-zinc-800 dark:text-zinc-100' },
    { label: 'To Do',       value: stats.by_status['todo'] ?? 0,        color: 'text-zinc-500' },
    { label: 'In Progress', value: stats.by_status['in_progress'] ?? 0, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Review',      value: stats.by_status['review'] ?? 0,      color: 'text-purple-600 dark:text-purple-400' },
    { label: 'Done',        value: stats.by_status['done'] ?? 0,        color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Overdue',     value: stats.overdue,                       color: 'text-red-600 dark:text-red-400' },
  ];

  const deptEntries = Object.entries(stats.by_department ?? {}).filter(([k]) => k !== 'None').sort((a, b) => b[1] - a[1]);

  return (
    <div className='bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 mb-6 overflow-hidden'>
      {/* Accordion header — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className='w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors'
      >
        <div className='flex items-center gap-2'>
          <BarChart2 className='w-4 h-4 text-blue-500 flex-shrink-0' />
          <span className='text-sm font-bold text-zinc-900 dark:text-zinc-100'>Overview</span>
        </div>
        <div className='flex items-center gap-3'>
          {/* KPI pill summary when collapsed */}
          {!open && (
            <div className='flex items-center gap-2'>
              {kpis.filter((k) => k.value > 0).map((k) => (
                <span key={k.label} className={`text-xs font-bold ${k.color}`}>
                  {k.value} <span className='font-normal text-zinc-400'>{k.label}</span>
                </span>
              ))}
            </div>
          )}
          <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Accordion body */}
      {open && (
        <div className='px-5 pb-5 border-t border-zinc-100 dark:border-zinc-800 pt-4'>
          <div className='grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6'>
            {kpis.map((k) => (
              <div key={k.label} className='bg-zinc-50 dark:bg-zinc-800/60 rounded-xl p-3 text-center'>
                <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
                <p className='text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium'>{k.label}</p>
              </div>
            ))}
          </div>

          {deptEntries.length > 0 && (
            <div className='mb-6'>
              <h3 className='text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3'>Tasks by Department</h3>
              <div className='flex flex-wrap gap-2'>
                {deptEntries.map(([dept, count]) => {
                  const dc = deptColor(dept);
                  return (
                    <span key={dept} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${dc.bg} ${dc.text}`}>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dc.dot}`} />
                      {dept}
                      <span className='opacity-60 font-bold ml-0.5'>{count}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {stats.by_assignee.length > 0 && (
            <>
              <h3 className='text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3'>Workload by Person</h3>
              <div className='overflow-x-auto'>
                <table className='w-full text-xs'>
                  <thead>
                    <tr className='border-b border-zinc-200 dark:border-zinc-700 text-zinc-500'>
                      <th className='text-left py-2 pr-4 font-semibold'>Person</th>
                      <th className='text-center px-3 font-semibold'>Total</th>
                      {STATUSES.map((s) => <th key={s.value} className={`text-center px-3 font-semibold ${s.color}`}>{s.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.by_assignee.sort((a, b) => b.total - a.total).map((a) => (
                      <tr key={a.user_id} className='border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'>
                        <td className='py-2.5 pr-4'>
                          <div className='flex items-center gap-2'>
                            <Avatar name={a.name} size='xs' />
                            <span className='font-semibold text-zinc-800 dark:text-zinc-200'>{a.name}</span>
                          </div>
                        </td>
                        <td className='text-center px-3 font-bold text-zinc-700 dark:text-zinc-200'>{a.total}</td>
                        {STATUSES.map((s) => (
                          <td key={s.value} className={`text-center px-3 font-semibold ${a.by_status[s.value] ? s.color : 'text-zinc-300 dark:text-zinc-700'}`}>
                            {a.by_status[s.value] ?? 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {stats.recent_activity?.length > 0 && (
            <div className='mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800'>
              <h3 className='text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3'>Recent Activity</h3>
              <div className='space-y-2'>
                {stats.recent_activity.slice(0, 8).map((item, i) => (
                  <div key={i} className='flex items-start gap-2 text-xs'>
                    <span className='text-zinc-300 dark:text-zinc-600 mt-0.5'>{ACTIVITY_ICONS[item.activity?.type] ?? '·'}</span>
                    <div>
                      <span className='font-semibold text-zinc-700 dark:text-zinc-300'>{item.activity?.actor_name}</span>
                      {' · '}
                      <span className='text-zinc-500 dark:text-zinc-400 truncate'>{item.task_title}</span>
                      <span className='ml-2 text-zinc-300 dark:text-zinc-600'>{fmtRelative(item.activity?.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Assignee Picker (grouped by department, with search) ──────────────────────

function AssigneePicker({ allUsers, assignedTo, assignedNames, onToggle }: {
  allUsers: AppUser[];
  assignedTo: string[];
  assignedNames: string[];
  onToggle: (u: AppUser) => void;
}) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  const departments = useMemo(() => {
    const depts = new Set(allUsers.map((u) => u.department).filter(Boolean) as string[]);
    return Array.from(depts).sort();
  }, [allUsers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allUsers.filter((u) => {
      const matchesDept = !deptFilter || u.department === deptFilter;
      const matchesSearch = !q || u.name.toLowerCase().includes(q) || (u.department ?? '').toLowerCase().includes(q);
      return matchesDept && matchesSearch;
    });
  }, [allUsers, search, deptFilter]);

  const grouped = useMemo(() => {
    const map: Record<string, AppUser[]> = {};
    filtered.forEach((u) => {
      const dept = u.department || 'No Department';
      if (!map[dept]) map[dept] = [];
      map[dept].push(u);
    });
    return Object.entries(map).sort(([a], [b]) => {
      if (a === 'No Department') return 1;
      if (b === 'No Department') return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  return (
    <div>
      <div className='flex items-center gap-2 mb-2'>
        <div className='relative flex-1'>
          <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400' />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Search by name or department…'
            className='w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500' />
        </div>
      </div>
      {departments.length > 0 && (
        <div className='flex flex-wrap gap-1.5 mb-2'>
          <button onClick={() => setDeptFilter('')}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${!deptFilter ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>
            All
          </button>
          {departments.map((d) => {
            const dc = deptColor(d);
            return (
              <button key={d} onClick={() => setDeptFilter(d === deptFilter ? '' : d)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${deptFilter === d ? `${dc.dot} text-white` : `${dc.bg} ${dc.text} hover:opacity-80`}`}>
                <Building2 className='w-2.5 h-2.5' />{d}
              </button>
            );
          })}
        </div>
      )}
      <div className='max-h-48 overflow-y-auto space-y-3'>
        {grouped.length === 0 && <p className='text-xs text-zinc-400 italic text-center py-2'>No users found</p>}
        {grouped.map(([dept, users]) => (
          <div key={dept}>
            <p className='text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1.5 flex items-center gap-1'>
              <Building2 className='w-2.5 h-2.5' />{dept}
            </p>
            <div className='flex flex-wrap gap-2'>
              {users.map((u) => {
                const sel = assignedTo.includes(u._id);
                return (
                  <button key={u._id} onClick={() => onToggle(u)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      sel ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-blue-400 dark:hover:border-blue-600'
                    }`}>
                    <Avatar name={u.name} size='xs' />
                    {u.name}
                    {sel && <Check className='w-3 h-3 ml-0.5' />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Create / Edit Modal ───────────────────────────────────────────────────────

function TaskModal({ initial, allUsers, currentUser, onClose, onSave }: {
  initial?: Partial<Task>; allUsers: AppUser[]; currentUser: any;
  onClose: () => void; onSave: (data: any) => Promise<void>;
}) {
  const [title, setTitle]             = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [priority, setPriority]       = useState(initial?.priority ?? 'medium');
  const [taskStatus, setTaskStatus]   = useState(initial?.status ?? 'todo');
  const [assignedTo, setAssignedTo]   = useState<string[]>(initial?.assigned_to ?? []);
  const [assignedNames, setAssignedNames] = useState<string[]>(initial?.assigned_to_names ?? []);
  const [assignedDepts, setAssignedDepts] = useState<string[]>(initial?.assigned_to_departments ?? []);
  const [deadline, setDeadline]       = useState(initial?.deadline ? initial.deadline.slice(0, 10) : '');
  const [tags, setTags]               = useState(initial?.tags?.join(', ') ?? '');
  const [saving, setSaving]           = useState(false);

  const toggleUser = (u: AppUser) => {
    if (assignedTo.includes(u._id)) {
      const idx = assignedTo.indexOf(u._id);
      setAssignedTo((p) => p.filter((id) => id !== u._id));
      setAssignedNames((p) => p.filter((_, i) => i !== idx));
      setAssignedDepts((p) => p.filter((_, i) => i !== idx));
    } else {
      setAssignedTo((p) => [...p, u._id]);
      setAssignedNames((p) => [...p, u.name]);
      setAssignedDepts((p) => [...p, u.department ?? '']);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      await onSave({
        title: title.trim(), description, priority, status: taskStatus,
        assigned_to: assignedTo, assigned_to_names: assignedNames,
        assigned_to_departments: assignedDepts,
        deadline: deadline || null,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        creator_department: currentUser?.department ?? null,
      });
      onClose();
    } catch { /* error surfaced by caller */ } finally { setSaving(false); }
  };

  return (
    <div className='fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'>
      <div className='bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 z-10'>
          <h2 className='text-sm font-bold text-zinc-900 dark:text-zinc-100'>{initial?._id ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className='p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors'><X className='w-4 h-4' /></button>
        </div>
        <div className='p-6 space-y-4'>
          <div>
            <label className='block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1'>Title <span className='text-red-400'>*</span></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder='What needs to be done?' autoFocus
              className='w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500' />
          </div>
          <div>
            <label className='block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1'>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder='Add context or notes…'
              className='w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed' />
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className='block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5'>Priority</label>
              <div className='grid grid-cols-2 gap-1.5'>
                {PRIORITIES.map((p) => (
                  <button key={p.value} onClick={() => setPriority(p.value)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      priority === p.value ? `${p.badge} border-current` : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />{p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className='block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5'>Status</label>
              <div className='space-y-1.5'>
                {STATUSES.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button key={s.value} onClick={() => setTaskStatus(s.value)}
                      className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        taskStatus === s.value ? `${s.bg} ${s.color} border-current` : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}>
                      <Icon className='w-3 h-3' />{s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div>
            <label className='block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1'>Deadline</label>
            <input type='date' value={deadline} onChange={(e) => setDeadline(e.target.value)}
              className='w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500' />
          </div>
          <div>
            <label className='block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5'>Assign to</label>
            <AssigneePicker allUsers={allUsers} assignedTo={assignedTo} assignedNames={assignedNames} onToggle={toggleUser} />
          </div>
          <div>
            <label className='block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1'>Tags <span className='font-normal text-zinc-400'>(comma-separated)</span></label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder='e.g. urgent, design, followup'
              className='w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500' />
          </div>
        </div>
        <div className='flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800'>
          <button onClick={onClose} className='px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors'>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className='flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 shadow-sm'>
            {saving && <Loader2 className='w-3.5 h-3.5 animate-spin' />}
            {initial?._id ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── File Upload ───────────────────────────────────────────────────────────────

function FileDropZone({ taskId, onUploaded, headers, currentUser }: {
  taskId: string; onUploaded: () => void; headers: any; currentUser: any;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('uploaded_by', currentUser._id);
      fd.append('uploaded_by_name', currentUser.name);
      await axios.post(`${API}/tasks/${taskId}/attachments`, fd, { headers });
      onUploaded();
      toast.success(`"${file.name}" uploaded`);
    } catch { toast.error('Upload failed'); } finally { setUploading(false); }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={async (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) await uploadFile(f); }}
      onClick={() => !uploading && fileRef.current?.click()}
      className={`flex flex-col items-center justify-center py-5 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
        dragOver ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.01]'
          : 'border-zinc-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
      }`}
    >
      <input ref={fileRef} type='file' className='hidden' onChange={async (e) => { const f = e.target.files?.[0]; if (f) await uploadFile(f); if (fileRef.current) fileRef.current.value = ''; }} />
      {uploading ? <Loader2 className='w-5 h-5 text-blue-500 animate-spin mb-1' /> : <Upload className={`w-5 h-5 mb-1 transition-colors ${dragOver ? 'text-blue-500' : 'text-zinc-300 dark:text-zinc-600'}`} />}
      <p className={`text-xs transition-colors ${dragOver ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-zinc-400'}`}>
        {uploading ? 'Uploading…' : dragOver ? 'Drop to upload' : 'Drop files here or click to browse'}
      </p>
    </div>
  );
}

// ── Description renderer (linkifies URLs) ────────────────────────────────────
const URL_RE = /(https?:\/\/[^\s]+)/g;

function DescriptionText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const url = match[0];
    parts.push(
      <a key={match.index} href={url} target='_blank' rel='noopener noreferrer'
        className='text-blue-500 dark:text-blue-400 underline underline-offset-2 hover:text-blue-700 dark:hover:text-blue-300 break-all transition-colors'>
        {url}
      </a>
    );
    last = match.index + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span>{parts}</span>;
}

// ── Task Drawer ───────────────────────────────────────────────────────────────

function TaskDrawer({ task: init, allUsers, currentUser, accessToken, onClose, onUpdate, onDelete }: {
  task: Task; allUsers: AppUser[]; currentUser: any; accessToken: string;
  onClose: () => void; onUpdate: (t: Task) => void; onDelete: (id: string) => void;
}) {
  const [task, setTask]                     = useState(init);
  const [editing, setEditing]               = useState(false);
  const [activeTab, setActiveTab]           = useState<'details' | 'activity'>('details');
  const [comment, setComment]               = useState('');
  const [submitting, setSubmitting]         = useState(false);
  const [deletingCmt, setDeletingCmt]       = useState<string | null>(null);
  const [deletingAtt, setDeletingAtt]       = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [confirmDel, setConfirmDel]         = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const assigneesAtPickerOpen = useRef<string[]>([]);
  const [editingDeadline, setEditingDeadline]             = useState(false);
  const [editingDescription, setEditingDescription]       = useState(false);
  const [descDraft, setDescDraft]                         = useState(task.description ?? '');
  const headers                             = { Authorization: `Bearer ${accessToken}` };

  const refresh = useCallback(async () => {
    const { data } = await axios.get(`${API}/tasks/${task._id}`, { headers });
    setTask(data); onUpdate(data);
  }, [task._id]);

  const patch = async (fields: Record<string, any>) => {
    const { data } = await axios.put(`${API}/tasks/${task._id}`, {
      ...fields, actor_id: currentUser._id, actor_name: currentUser.name,
    }, { headers });
    setTask(data); onUpdate(data);
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await axios.post(`${API}/tasks/${task._id}/comments`, {
        text: comment.trim(), author_id: currentUser._id, author_name: currentUser.name,
      }, { headers });
      setComment(''); await refresh();
    } catch { toast.error('Failed to add comment'); } finally { setSubmitting(false); }
  };

  const handleDeleteComment = async (cid: string) => {
    setDeletingCmt(cid);
    try { await axios.delete(`${API}/tasks/${task._id}/comments/${cid}`, { headers }); await refresh(); }
    catch { toast.error('Failed to delete comment'); } finally { setDeletingCmt(null); }
  };

  const handleOpenAtt = async (fileId: string) => {
    try { const { data } = await axios.get(`${API}/tasks/${task._id}/attachments/${fileId}/url`, { headers }); window.open(data.url, '_blank'); }
    catch { toast.error('Could not open file'); }
  };

  const handleDownloadAtt = async (fileId: string, filename: string) => {
    try {
      const { data } = await axios.get(`${API}/tasks/${task._id}/attachments/${fileId}/url`, { headers, params: { download: true } });
      const a = document.createElement('a');
      a.href = data.url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch { toast.error('Could not download file'); }
  };

  const handleDownloadAllAtts = async () => {
    setDownloadingAll(true);
    try {
      const response = await axios.get(`${API}/tasks/${task._id}/attachments/download-all`, {
        headers,
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const contentDisposition = response.headers['content-disposition'] || '';
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `task_attachments.zip`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { toast.error('Could not download attachments'); } finally { setDownloadingAll(false); }
  };

  const handleDeleteAtt = async (fileId: string) => {
    setDeletingAtt(fileId);
    try { await axios.delete(`${API}/tasks/${task._id}/attachments/${fileId}`, { headers }); await refresh(); }
    catch { toast.error('Failed to delete'); } finally { setDeletingAtt(null); }
  };

  const handleDeleteTask = async () => {
    try { await axios.delete(`${API}/tasks/${task._id}`, { headers }); onDelete(task._id); onClose(); toast.success('Task deleted'); }
    catch { toast.error('Failed to delete task'); }
  };

  const handleHide = async () => {
    try {
      await axios.put(`${API}/tasks/${task._id}`, { is_hidden: true, actor_id: currentUser._id, actor_name: currentUser.name }, { headers });
      onDelete(task._id); onClose(); toast.success('Task hidden');
    } catch { toast.error('Failed to hide task'); }
  };

  const handleUnhide = async () => {
    try {
      const { data } = await axios.put(`${API}/tasks/${task._id}`, { is_hidden: false, actor_id: currentUser._id, actor_name: currentUser.name }, { headers });
      setTask(data); onUpdate(data); toast.success('Task unhidden');
    } catch { toast.error('Failed to unhide task'); }
  };

  const overdue = isOverdue(task.deadline, task.status);

  return (
    <>
      <div className='fixed inset-0 z-40 bg-black/30 backdrop-blur-sm' onClick={onClose} />
      <div className='fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white dark:bg-zinc-900 shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800'>
        <div className='px-5 pt-4 pb-3 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0'>
          <div className='flex items-start gap-2 mb-2'>
            <div className='flex items-center gap-1.5 flex-wrap flex-1 min-w-0'>
              <PriorityBadge priority={task.priority} />
              <StatusBadge status={task.status} />
              {taskForDepts(task).map((d) => <DeptChip key={d} dept={d} />)}
              {overdue && (
                <span className='flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded'>
                  <AlertCircle className='w-2.5 h-2.5' /> Overdue
                </span>
              )}
            </div>
            <div className='flex items-center gap-1 flex-shrink-0'>
              <button onClick={() => setEditing(true)}
                className='flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors'>
                <Edit2 className='w-3 h-3' /> Edit
              </button>
              {task.is_hidden ? (
                <button onClick={handleUnhide} title='Unhide task'
                  className='flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors'>
                  <Eye className='w-3 h-3' /> Unhide
                </button>
              ) : task.status === 'done' && (
                <button onClick={handleHide} title='Hide this task'
                  className='flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors'>
                  <EyeOff className='w-3 h-3' /> Hide
                </button>
              )}
              {task.status !== 'done' && (!confirmDel ? (
                <button onClick={() => setConfirmDel(true)} className='p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors'>
                  <Trash2 className='w-4 h-4' />
                </button>
              ) : (
                <div className='flex gap-1'>
                  <button onClick={handleDeleteTask} className='px-2.5 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg'>Delete</button>
                  <button onClick={() => setConfirmDel(false)} className='px-2.5 py-1.5 text-xs font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-500 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800'>Cancel</button>
                </div>
              ))}
              <button onClick={onClose} className='p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors'>
                <X className='w-4 h-4' />
              </button>
            </div>
          </div>
          <h2 className='text-base font-bold text-zinc-900 dark:text-zinc-100 leading-snug mb-0.5'>{task.title}</h2>
          <p className='text-[10px] text-zinc-400'>Created by {task.created_by_name} · {fmtDateTime(task.created_at)}</p>
        </div>

        <div className='grid grid-cols-2 gap-2 px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0'>
          <div>
            <label className='block text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1'>Status</label>
            <select value={task.status} onChange={(e) => patch({ status: e.target.value })}
              className='w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500'>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className='block text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1'>Priority</label>
            <select value={task.priority} onChange={(e) => patch({ priority: e.target.value })}
              className='w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500'>
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        <div className='flex border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0'>
          {(['details', 'activity'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-xs font-bold capitalize border-b-2 transition-colors ${
                activeTab === tab ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}>
              {tab}
              {tab === 'activity' && (task.activity?.length ?? 0) > 0 && (
                <span className='ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500'>{task.activity.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className='flex-1 overflow-y-auto'>
          {activeTab === 'details' ? (
            <div>
              <div className='px-5 py-4 border-b border-zinc-100 dark:border-zinc-800'>
                <div className='flex items-center justify-between mb-2'>
                  <p className='text-[10px] font-bold text-zinc-400 uppercase tracking-wide'>Assignees</p>
                  <button onClick={async () => {
                    if (!showAssigneePicker) {
                      // Opening picker — snapshot current assignees
                      assigneesAtPickerOpen.current = [...task.assigned_to];
                      setShowAssigneePicker(true);
                    } else {
                      // Closing picker — notify only if new assignees were added
                      setShowAssigneePicker(false);
                      const prevIds = new Set(assigneesAtPickerOpen.current);
                      const hasNew = task.assigned_to.some((id) => !prevIds.has(id));
                      if (hasNew) {
                        try {
                          await patch({
                            assigned_to: task.assigned_to,
                            assigned_to_names: task.assigned_to_names,
                            assigned_to_departments: task.assigned_to_departments,
                            notify_assignees: true,
                          });
                        } catch { toast.error('Failed to send assignment notification'); }
                      }
                    }
                  }}
                    className='flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors'>
                    <Plus className='w-3 h-3' />{showAssigneePicker ? 'Done' : 'Edit'}
                  </button>
                </div>
                {task.assigned_to_names.length > 0 ? (
                  <div className='flex flex-wrap gap-2 mb-2'>
                    {task.assigned_to_names.map((name, i) => {
                      const uid = task.assigned_to[i];
                      const user = allUsers.find((u) => u._id === uid);
                      return (
                        <div key={uid} className='flex items-center gap-2 px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg group'>
                          <Avatar name={name} size='xs' />
                          <div className='flex-1 min-w-0'>
                            <p className='text-xs font-semibold text-zinc-800 dark:text-zinc-200'>{name}</p>
                            {user?.department && <p className='text-[10px] text-teal-500'>{user.department}</p>}
                            {user?.email && <p className='text-[10px] text-zinc-400'>{user.email}</p>}
                          </div>
                          {showAssigneePicker && (
                            <button onClick={async () => {
                              const newIds   = task.assigned_to.filter((_, j) => j !== i);
                              const newNames = task.assigned_to_names.filter((_, j) => j !== i);
                              const newDepts = (task.assigned_to_departments ?? []).filter((_, j) => j !== i);
                              try { await patch({ assigned_to: newIds, assigned_to_names: newNames, assigned_to_departments: newDepts }); }
                              catch { toast.error('Failed to update assignees'); }
                            }} className='p-0.5 rounded text-zinc-300 hover:text-red-400 transition-colors flex-shrink-0'>
                              <X className='w-3 h-3' />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : <span className='text-xs text-zinc-400 italic mb-2 block'>Unassigned</span>}
                {showAssigneePicker && (
                  <div className='mt-2 p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700'>
                    <AssigneePicker
                      allUsers={allUsers}
                      assignedTo={task.assigned_to}
                      assignedNames={task.assigned_to_names}
                      onToggle={async (u) => {
                        let newIds: string[], newNames: string[], newDepts: string[];
                        if (task.assigned_to.includes(u._id)) {
                          const idx = task.assigned_to.indexOf(u._id);
                          newIds   = task.assigned_to.filter((_, j) => j !== idx);
                          newNames = task.assigned_to_names.filter((_, j) => j !== idx);
                          newDepts = (task.assigned_to_departments ?? []).filter((_, j) => j !== idx);
                        } else {
                          newIds   = [...task.assigned_to, u._id];
                          newNames = [...task.assigned_to_names, u.name];
                          newDepts = [...(task.assigned_to_departments ?? []), u.department ?? ''];
                        }
                        try { await patch({ assigned_to: newIds, assigned_to_names: newNames, assigned_to_departments: newDepts }); }
                        catch { toast.error('Failed to update assignees'); }
                      }}
                    />
                  </div>
                )}
              </div>

              <div className='px-5 py-4 space-y-3.5 border-b border-zinc-100 dark:border-zinc-800'>
                <div>
                  <p className='text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1'>Created At</p>
                  <span className='text-sm font-semibold text-zinc-800 dark:text-zinc-100'>{fmtDateTime(task.created_at)}</span>
                </div>
                <div>
                  <div className='flex items-center justify-between mb-1'>
                    <p className='text-[10px] font-bold text-zinc-400 uppercase tracking-wide'>Deadline</p>
                    <button onClick={() => setEditingDeadline((v) => !v)}
                      className='flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors'>
                      <Edit2 className='w-2.5 h-2.5' />{editingDeadline ? 'Done' : 'Edit'}
                    </button>
                  </div>
                  {editingDeadline ? (
                    <div className='flex items-center gap-2'>
                      <input type='date' defaultValue={task.deadline ? task.deadline.slice(0, 10) : ''}
                        autoFocus
                        onChange={async (e) => {
                          try {
                            await patch({ deadline: e.target.value || null });
                          } catch { toast.error('Failed to update deadline'); }
                        }}
                        className='px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500' />
                      {task.deadline && (
                        <button onClick={async () => {
                          try { await patch({ deadline: null }); }
                          catch { toast.error('Failed to clear deadline'); }
                        }} className='text-[10px] text-red-400 hover:text-red-600 font-semibold'>Clear</button>
                      )}
                    </div>
                  ) : task.deadline ? (
                    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${overdue ? 'text-red-500' : 'text-zinc-800 dark:text-zinc-100'}`}>
                      <Calendar className='w-3.5 h-3.5' />{fmtDate(task.deadline)}{overdue && <span className='text-xs text-red-500 ml-1'>(Overdue)</span>}
                    </span>
                  ) : (
                    <button onClick={() => setEditingDeadline(true)} className='text-xs text-zinc-400 italic hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors'>No deadline set — click to add</button>
                  )}
                </div>
                {task.tags.length > 0 && (
                  <div>
                    <p className='text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1.5'>Tags</p>
                    <div className='flex flex-wrap gap-1'>
                      {task.tags.map((tag) => (
                        <span key={tag} className='px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'>#{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className='px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 overflow-hidden'>
                <div className='flex items-center justify-between mb-2'>
                  <p className='text-[10px] font-bold text-zinc-400 uppercase tracking-wide'>Description</p>
                  {!editingDescription ? (
                    <button onClick={() => { setDescDraft(task.description ?? ''); setEditingDescription(true); }}
                      className='flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors'>
                      <Edit2 className='w-2.5 h-2.5' />Edit
                    </button>
                  ) : (
                    <div className='flex items-center gap-1'>
                      <button onClick={async () => {
                        try { await patch({ description: descDraft.trim() || null }); setEditingDescription(false); }
                        catch { toast.error('Failed to update description'); }
                      }} className='px-2.5 py-1 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors'>Save</button>
                      <button onClick={() => setEditingDescription(false)}
                        className='px-2.5 py-1 text-[10px] font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-500 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors'>Cancel</button>
                    </div>
                  )}
                </div>
                {editingDescription ? (
                  <textarea
                    autoFocus
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    rows={5}
                    placeholder='Add context or notes…'
                    className='w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed'
                  />
                ) : task.description ? (
                  <p className='text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed break-words min-w-0'>
                    <DescriptionText text={task.description} />
                  </p>
                ) : (
                  <p className='text-xs text-zinc-400 italic'>No description — click Edit to add one</p>
                )}
              </div>

              <div className='px-5 py-4 border-b border-zinc-100 dark:border-zinc-800'>
                <div className='flex items-center justify-between mb-3'>
                  <p className='text-[10px] font-bold text-zinc-400 uppercase tracking-wide'>Attachments ({task.attachments.length})</p>
                  {task.attachments.length > 1 && (
                    <button
                      onClick={handleDownloadAllAtts}
                      disabled={downloadingAll}
                      className='flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50'
                    >
                      {downloadingAll ? <Loader2 className='w-3 h-3 animate-spin' /> : <Download className='w-3 h-3' />}
                      Download All
                    </button>
                  )}
                </div>
                {task.attachments.length > 0 && (
                  <div className='space-y-1.5 mb-3'>
                    {task.attachments.map((att) => {
                      const Icon = fileIcon(att.content_type);
                      return (
                        <div key={att.file_id} className='flex items-center gap-2.5 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 group hover:border-zinc-300 transition-colors'>
                          <div className='w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0'>
                            <Icon className='w-4 h-4 text-zinc-500 dark:text-zinc-400' />
                          </div>
                          <div className='flex-1 min-w-0'>
                            <p className='text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate'>{att.filename}</p>
                            <p className='text-[10px] text-zinc-400'>{fmtBytes(att.size)} · {att.uploaded_by_name} · {fmtRelative(att.uploaded_at)}</p>
                          </div>
                          <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                            <button
                              onClick={() => handleOpenAtt(att.file_id)}
                              title='View file'
                              className='p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-600'
                            >
                              <Eye className='w-3.5 h-3.5' />
                            </button>
                            <button
                              onClick={() => handleDownloadAtt(att.file_id, att.filename)}
                              title='Download file'
                              className='p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-zinc-400 hover:text-blue-500'
                            >
                              <Download className='w-3.5 h-3.5' />
                            </button>
                            <button onClick={() => handleDeleteAtt(att.file_id)} disabled={deletingAtt === att.file_id} className='p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-500'>
                              {deletingAtt === att.file_id ? <Loader2 className='w-3.5 h-3.5 animate-spin' /> : <Trash2 className='w-3.5 h-3.5' />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <FileDropZone taskId={task._id} headers={headers} currentUser={currentUser} onUploaded={refresh} />
              </div>

              <div className='px-5 py-4'>
                <p className='text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-3'>Comments ({task.comments.length})</p>
                <div className='space-y-4 mb-4'>
                  {task.comments.length === 0 && <p className='text-xs text-zinc-400 italic text-center py-4'>No comments yet.</p>}
                  {task.comments.map((c) => (
                    <div key={c.comment_id} className='flex gap-2.5 group'>
                      <Avatar name={c.author_name} size='sm' />
                      <div className='flex-1 min-w-0'>
                        <div className='flex items-baseline gap-2 mb-1'>
                          <span className='text-xs font-bold text-zinc-800 dark:text-zinc-200'>{c.author_name}</span>
                          <span className='text-[10px] text-zinc-400'>{fmtRelative(c.created_at)}</span>
                          {(currentUser._id === c.author_id || currentUser.role === 'admin') && (
                            <button onClick={() => handleDeleteComment(c.comment_id)} disabled={deletingCmt === c.comment_id}
                              className='ml-auto opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-300 hover:text-red-400 transition-all'>
                              {deletingCmt === c.comment_id ? <Loader2 className='w-3 h-3 animate-spin' /> : <Trash2 className='w-3 h-3' />}
                            </button>
                          )}
                        </div>
                        <div className='bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl rounded-tl-none px-3.5 py-2.5'>
                          <p className='text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed'>{c.text}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className='flex gap-2.5'>
                  <Avatar name={currentUser.name} size='sm' />
                  <div className='flex-1 relative'>
                    <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddComment(); }}
                      placeholder='Add a comment… (⌘+Enter to send)'
                      className='w-full px-3.5 py-2.5 text-sm rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none pr-16 leading-relaxed' />
                    <button onClick={handleAddComment} disabled={submitting || !comment.trim()}
                      className='absolute bottom-2 right-2 px-2.5 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-40'>
                      {submitting ? <Loader2 className='w-3.5 h-3.5 animate-spin' /> : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className='px-5 py-4'>
              <ActivityFeed entries={task.activity ?? []} />
            </div>
          )}
        </div>
        {editing && (
          <TaskModal
            initial={task}
            allUsers={allUsers}
            currentUser={currentUser}
            onClose={() => setEditing(false)}
            onSave={async (data) => {
              await patch({ ...data, actor_id: currentUser._id, actor_name: currentUser.name });
              setEditing(false);
            }}
          />
        )}
      </div>
    </>
  );
}

// ── Report Download Modal ─────────────────────────────────────────────────────

function ReportModal({ allUsers, allDepartments, accessToken, onClose }: {
  allUsers: AppUser[];
  allDepartments: string[];
  accessToken: string;
  onClose: () => void;
}) {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const [mode, setMode]               = useState<'month' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState(() => today.toISOString().slice(0, 7)); // YYYY-MM
  const [startDate, setStartDate]     = useState(firstOfMonth);
  const [endDate, setEndDate]         = useState(todayStr);
  const [department, setDepartment]   = useState('');
  const [userId, setUserId]           = useState('');
  const [downloading, setDownloading] = useState(false);

  const computedDates = useMemo(() => {
    if (mode === 'custom') return { start: startDate, end: endDate };
    const [y, m] = selectedMonth.split('-').map(Number);
    const start = `${selectedMonth}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
    return { start, end };
  }, [mode, selectedMonth, startDate, endDate]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams({
        start_date: computedDates.start,
        end_date: computedDates.end,
      });
      if (department) params.set('department', department);
      if (userId) params.set('user_id', userId);

      const resp = await axios.get(`${API}/tasks/report/download?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'blob',
      });
      const blob = new Blob([resp.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = (resp.headers['content-disposition'] as string) || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      a.download = match ? match[1] : `tasks_report_${computedDates.start}_to_${computedDates.end}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Report downloaded');
      onClose();
    } catch {
      toast.error('Failed to download report');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className='fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'>
      <div className='bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800'>
          <div className='flex items-center gap-2'>
            <Download className='w-4 h-4 text-blue-500' />
            <h2 className='text-sm font-bold text-zinc-900 dark:text-zinc-100'>Download Tasks Report</h2>
          </div>
          <button onClick={onClose} className='p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors'>
            <X className='w-4 h-4' />
          </button>
        </div>

        <div className='p-6 space-y-5'>
          {/* Mode toggle */}
          <div>
            <label className='block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2'>Period</label>
            <div className='flex rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden'>
              {(['month', 'custom'] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 py-2 text-xs font-semibold transition-colors capitalize ${
                    mode === m
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}>
                  {m === 'month' ? 'By Month' : 'Custom Range'}
                </button>
              ))}
            </div>
          </div>

          {mode === 'month' ? (
            <div>
              <label className='block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5'>Month</label>
              <input type='month' value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                max={today.toISOString().slice(0, 7)}
                className='w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500' />
            </div>
          ) : (
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <label className='block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5'>From</label>
                <input type='date' value={startDate} onChange={(e) => setStartDate(e.target.value)} max={endDate}
                  className='w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500' />
              </div>
              <div>
                <label className='block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5'>To</label>
                <input type='date' value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} max={todayStr}
                  className='w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500' />
              </div>
            </div>
          )}

          <div>
            <label className='block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5'>Department <span className='font-normal text-zinc-400'>(optional)</span></label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)}
              className='w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500'>
              <option value=''>All departments</option>
              {allDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className='block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5'>Person <span className='font-normal text-zinc-400'>(optional)</span></label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)}
              className='w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500'>
              <option value=''>All people</option>
              {allUsers.map((u) => (
                <option key={u._id} value={u._id}>{u.name}{u.department ? ` (${u.department})` : ''}</option>
              ))}
            </select>
          </div>

          <div className='bg-zinc-50 dark:bg-zinc-800/60 rounded-xl p-3 text-xs text-zinc-500 dark:text-zinc-400'>
            <p className='font-semibold text-zinc-700 dark:text-zinc-300 mb-1'>Report includes 3 sheets:</p>
            <ul className='space-y-0.5 list-disc list-inside'>
              <li><span className='font-medium'>Summary</span> — completion rate per person</li>
              <li><span className='font-medium'>Tasks Detail</span> — all tasks with status, deadline &amp; assignees</li>
              <li><span className='font-medium'>By Department</span> — department-level breakdown</li>
            </ul>
          </div>
        </div>

        <div className='flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800'>
          <button onClick={onClose} className='px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors'>
            Cancel
          </button>
          <button onClick={handleDownload} disabled={downloading}
            className='flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50 shadow-sm'>
            {downloading ? <Loader2 className='w-3.5 h-3.5 animate-spin' /> : <Download className='w-3.5 h-3.5' />}
            {downloading ? 'Generating…' : 'Download Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Main Component ────────────────────────────────────────────────────────────

export default function GeneralTasks() {
  const { accessToken, user: currentUser } = useAuth();

  const isAdminOrManager = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const [tasks, setTasks]           = useState<Task[]>([]);
  const [allUsers, setAllUsers]     = useState<AppUser[]>([]);
  const [stats, setStats]           = useState<Stats | null>(null);
  const [loading, setLoading]       = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterDept, setFilterDept]         = useState('');
  const [activeStatus, setActiveStatus]     = useState('');
  const [showHidden, setShowHidden]         = useState(false);
  const [search, setSearch]                 = useState('');
  const [sortBy, setSortBy]                 = useState<SortField>('created_at');
  const [sortDir, setSortDir]               = useState<SortDir>('desc');
  const [view, setView]                     = useState<ViewMode>(isAdminOrManager ? 'department' : 'kanban');
  const headers = { Authorization: `Bearer ${accessToken}` };

  const allDepartments = useMemo(() => {
    const depts = new Set(allUsers.map((u) => u.department).filter(Boolean) as string[]);
    return Array.from(depts).sort();
  }, [allUsers]);

  const fetchTasks = useCallback(async () => {
    if (!accessToken) return;
    try {
      const params: Record<string, string> = {
        sort_by: sortBy, sort_dir: sortDir,
        viewer_id: currentUser._id,
        viewer_role: currentUser.role,
      };
      if (activeStatus)    params.status      = activeStatus;
      if (filterPriority)  params.priority    = filterPriority;
      if (filterAssignee)  params.assigned_to = filterAssignee;
      if (filterDept)      params.department  = filterDept;
      if (search)          params.search      = search;
      if (showHidden)      params.show_hidden = 'true';
      const { data } = await axios.get(`${API}/tasks`, { headers, params });
      setTasks(data);
    } catch { toast.error('Failed to load tasks'); }
  }, [accessToken, activeStatus, filterPriority, filterAssignee, filterDept, search, sortBy, sortDir, showHidden]);

  const fetchUsers = useCallback(async () => {
    if (!accessToken) return;
    try {
      const { data } = await axios.get(`${API}/users`, { headers });
      setAllUsers(data);
    } catch { /* non-critical */ }
  }, [accessToken]);

  const fetchStats = useCallback(async () => {
    if (!accessToken || !isAdminOrManager) return;
    try {
      const { data } = await axios.get(`${API}/tasks/stats`, {
        headers, params: { viewer_id: currentUser._id, viewer_role: currentUser.role },
      });
      setStats(data);
    } catch { /* non-critical */ }
  }, [accessToken, isAdminOrManager]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchTasks(), fetchUsers(), fetchStats()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTasks(); }, [activeStatus, filterPriority, filterAssignee, filterDept, search, sortBy, sortDir, showHidden]);

  const handleCreate = async (data: any) => {
    try {
      const { data: created } = await axios.post(`${API}/tasks`, {
        ...data, created_by: currentUser._id, created_by_name: currentUser.name,
      }, { headers });
      setTasks((p) => [created, ...p]);
      toast.success('Task created');
      if (isAdminOrManager) fetchStats();
    } catch { toast.error('Failed to create task'); throw new Error('failed'); }
  };

  const handleUpdate = (updated: Task) => {
    setTasks((p) => p.map((t) => t._id === updated._id ? updated : t));
    if (selectedTask?._id === updated._id) setSelectedTask(updated);
    if (isAdminOrManager) fetchStats();
  };

  const handleDelete = (id: string) => {
    setTasks((p) => p.filter((t) => t._id !== id));
    if (isAdminOrManager) fetchStats();
  };

  const handleKanbanDrop = async (taskId: string, newStatus: string) => {
    const task = tasks.find((t) => t._id === taskId);
    if (!task || task.status === newStatus) return;
    setTasks((p) => p.map((t) => t._id === taskId ? { ...t, status: newStatus as Task['status'] } : t));
    try {
      const { data } = await axios.put(`${API}/tasks/${taskId}`, {
        status: newStatus, actor_id: currentUser._id, actor_name: currentUser.name,
      }, { headers });
      setTasks((p) => p.map((t) => t._id === taskId ? data : t));
      if (selectedTask?._id === taskId) setSelectedTask(data);
      if (isAdminOrManager) fetchStats();
    } catch {
      setTasks((p) => p.map((t) => t._id === taskId ? { ...t, status: task.status } : t));
      toast.error('Failed to move task');
    }
  };

  const tasksByStatus = (s: string) => tasks.filter((t) => t.status === s);

  if (loading) return (
    <div className='flex items-center justify-center min-h-64'>
      <Loader2 className='w-6 h-6 animate-spin text-blue-500' />
    </div>
  );

  return (
    <div className='p-4 sm:p-6 max-w-[1600px] mx-auto'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6'>
        <div>
          <h1 className='text-xl font-black text-zinc-900 dark:text-zinc-100'>Tasks</h1>
          <p className='text-xs text-zinc-400 mt-0.5'>
            {isAdminOrManager ? `All tasks · ${tasks.length} shown` : `Your tasks · ${tasks.length} shown`}
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <button onClick={() => { fetchTasks(); if (isAdminOrManager) fetchStats(); }}
            className='p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors'>
            <RefreshCw className='w-4 h-4' />
          </button>
          {isAdminOrManager && (
            <button onClick={() => setShowReport(true)}
              className='flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-colors'>
              <Download className='w-4 h-4' /> Report
            </button>
          )}
          <button onClick={() => setShowCreate(true)}
            className='flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm'>
            <Plus className='w-4 h-4' /> New Task
          </button>
        </div>
      </div>

      {/* Stats */}
      {isAdminOrManager && stats && <StatsPanel stats={stats} />}

      {/* Filters */}
      <div className='flex flex-wrap items-center gap-2 mb-4'>
        <div className='relative flex-1 min-w-[180px] max-w-xs'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400' />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Search tasks…'
            className='w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500' />
        </div>

        {/* Status pills */}
        <div className='flex flex-wrap items-center gap-1'>
          {[{ value: '', label: 'All' }, ...STATUSES.map((s) => ({ value: s.value, label: s.label }))].map((s) => (
            <button key={s.value} onClick={() => setActiveStatus(s.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                activeStatus === s.value ? 'bg-blue-600 text-white shadow-sm' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}>
              {s.label}
            </button>
          ))}
        </div>

        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
          className='px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none'>
          <option value=''>All priorities</option>
          {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>

        {/* Department filter — show for admins/managers or if there are known departments */}
        {(isAdminOrManager || allDepartments.length > 0) && (
          <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
            className='px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none'>
            <option value=''>All departments</option>
            {allDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}

        {isAdminOrManager && (
          <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}
            className='px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none'>
            <option value=''>All assignees</option>
            {allUsers.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
        )}

        <select value={`${sortBy}:${sortDir}`} onChange={(e) => { const [f, d] = e.target.value.split(':'); setSortBy(f as SortField); setSortDir(d as SortDir); }}
          className='px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none'>
          <option value='created_at:desc'>Newest first</option>
          <option value='created_at:asc'>Oldest first</option>
          <option value='deadline:asc'>Deadline ↑</option>
          <option value='priority:asc'>Priority ↑</option>
          <option value='updated_at:desc'>Recently updated</option>
          <option value='title:asc'>Title A→Z</option>
        </select>

        <button onClick={() => setShowHidden((v) => !v)}
          title={showHidden ? 'Hide completed tasks' : 'Show completed tasks > 2 days old'}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
            showHidden
              ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
              : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
          }`}>
          {showHidden ? <Eye className='w-3.5 h-3.5' /> : <EyeOff className='w-3.5 h-3.5' />}
          {showHidden ? 'Showing hidden' : 'Show hidden'}
        </button>

        {/* View toggle */}
        <div className='flex items-center gap-1 ml-auto bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1'>
          {([
            ['kanban',     LayoutGrid, 'Kanban'],
            ['list',       List,       'List'],
            ['assignee',   Users,      'By Person'],
            ['department', Building2,  'By Dept'],
          ] as const).map(([v, Icon, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                view === v ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}>
              <Icon className='w-3.5 h-3.5' />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Views */}
      {view === 'kanban' && (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
          {STATUSES.map((s) => (
            <KanbanColumn key={s.value} statusDef={s} tasks={tasksByStatus(s.value)}
              onTaskClick={setSelectedTask} onDrop={handleKanbanDrop}
              onAddTask={s.value === 'todo' ? () => setShowCreate(true) : undefined} />
          ))}
        </div>
      )}

      {view === 'list' && (
        <div className='bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden'>
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead className='bg-zinc-50 dark:bg-zinc-800/60'>
                <tr className='border-b border-zinc-200 dark:border-zinc-700'>
                  <th className='w-8' />
                  <th className='text-left px-2 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider'>Title</th>
                  <th className='text-left px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider'>Priority</th>
                  <th className='text-left px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider'>Status</th>
                  <th className='text-left px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider'>Assignees</th>
                  <th className='text-left px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider'>Deadline</th>
                  <th className='text-left px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider'>Updated</th>
                  <th className='px-4 py-3' />
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => <ListRow key={task._id} task={task} onClick={() => setSelectedTask(task)} />)}
                {tasks.length === 0 && (
                  <tr><td colSpan={8} className='text-center py-16 text-zinc-400 text-sm'>No tasks found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'assignee' && <AssigneeView tasks={tasks} users={allUsers} onTaskClick={setSelectedTask} />}

      {view === 'department' && <DepartmentView tasks={tasks} onTaskClick={setSelectedTask} />}

      {/* Drawer */}
      {selectedTask && (
        <TaskDrawer task={selectedTask} allUsers={allUsers} currentUser={currentUser}
          accessToken={accessToken!} onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdate} onDelete={handleDelete} />
      )}

      {/* Create modal */}
      {showCreate && (
        <TaskModal allUsers={allUsers} currentUser={currentUser} onClose={() => setShowCreate(false)} onSave={handleCreate} />
      )}

      {/* Report modal */}
      {showReport && (
        <ReportModal
          allUsers={allUsers}
          allDepartments={allDepartments}
          accessToken={accessToken!}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
