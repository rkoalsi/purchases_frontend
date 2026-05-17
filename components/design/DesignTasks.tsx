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
  User, Edit2, Check,
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
  deadline?: string; tags: string[];
  created_by: string; created_by_name: string;
  comments: Comment[]; attachments: Attachment[];
  activity: ActivityEntry[]; created_at: string; updated_at: string;
}
interface AppUser { _id: string; name: string; email: string; role: string; permissions: string[] }
interface Permission { _id: string; name: string; description: string }
interface Stats {
  total: number; by_status: Record<string, number>; by_priority: Record<string, number>;
  overdue: number;
  by_assignee: { user_id: string; name: string; total: number; by_status: Record<string, number> }[];
  recent_activity: { activity: ActivityEntry; task_id: string; task_title: string }[];
}
type SortField = 'created_at' | 'updated_at' | 'deadline' | 'priority' | 'title';
type SortDir   = 'asc' | 'desc';
type ViewMode  = 'kanban' | 'list' | 'assignee';

// ── Config ────────────────────────────────────────────────────────────────────

const PRIORITIES = [
  { value: 'urgent', label: 'Urgent', border: 'border-l-red-500',    dot: 'bg-red-500',    badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',       color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50 dark:bg-red-900/20' },
  { value: 'high',   label: 'High',   border: 'border-l-orange-500', dot: 'bg-orange-500', badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  { value: 'medium', label: 'Medium', border: 'border-l-yellow-500', dot: 'bg-yellow-500', badge: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  { value: 'low',    label: 'Low',    border: 'border-l-green-500',  dot: 'bg-green-500',  badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',   color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/20' },
];

const STATUSES = [
  { value: 'todo',        label: 'To Do',       icon: Circle,       color: 'text-zinc-500 dark:text-zinc-400',       bg: 'bg-zinc-100 dark:bg-zinc-800',         header: 'bg-zinc-50 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700' },
  { value: 'in_progress', label: 'In Progress', icon: Clock,        color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-900/20',       header: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' },
  { value: 'review',      label: 'Review',      icon: ArrowRight,   color: 'text-purple-600 dark:text-purple-400',   bg: 'bg-purple-50 dark:bg-purple-900/20',   header: 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800' },
  { value: 'done',        label: 'Done',        icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', header: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800' },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'created_at',  label: 'Created' },
  { value: 'updated_at',  label: 'Updated' },
  { value: 'deadline',    label: 'Deadline' },
  { value: 'priority',    label: 'Priority' },
  { value: 'title',       label: 'Title' },
];

const ACTIVITY_ICONS: Record<string, string> = {
  created: '✦', status_changed: '↔', priority_changed: '⚑',
  comment_added: '💬', comment_deleted: '🗑',
  attachment_added: '📎', attachment_deleted: '🗑',
  title_changed: '✎', deadline_changed: '📅',
};

const DESIGN_PERMISSION_PREFIX = 'design_';

// ── Pure helpers ──────────────────────────────────────────────────────────────

const getPriority = (v: string) => PRIORITIES.find((p) => p.value === v) ?? PRIORITIES[2];
const getStatus   = (v: string) => STATUSES.find((s) => s.value === v)   ?? STATUSES[0];

function fmtDate(s?: string | null) {
  if (!s) return null;
  try { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return s; }
}
function fmtDateTime(s?: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return s; }
}
function fmtRelative(s?: string) {
  if (!s) return '';
  const diff = Date.now() - new Date(s).getTime();
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

// ── Task Card (draggable) ─────────────────────────────────────────────────────

function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const p = getPriority(task.priority);
  const overdue = isOverdue(task.deadline, task.status);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('taskId', task._id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      className={`bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 border-l-4 ${p.border} p-3.5 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-150 group select-none`}
    >
      <div className='flex items-start justify-between gap-2 mb-2.5'>
        <PriorityBadge priority={task.priority} />
        {overdue && (
          <span className='flex items-center gap-1 text-[10px] font-semibold text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded'>
            <AlertCircle className='w-2.5 h-2.5' /> Overdue
          </span>
        )}
      </div>

      <h3 className='text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug'>
        {task.title}
      </h3>

      {task.description && (
        <p className='text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-2.5 leading-relaxed'>{task.description}</p>
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

// ── Kanban Column (drop target) ───────────────────────────────────────────────

function KanbanColumn({ statusDef, tasks, onTaskClick, onDrop, onAddTask }: {
  statusDef: typeof STATUSES[number];
  tasks: Task[];
  onTaskClick: (t: Task) => void;
  onDrop: (taskId: string, newStatus: string) => void;
  onAddTask?: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const Icon = statusDef.icon;

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
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
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`space-y-2.5 flex-1 min-h-[200px] rounded-xl transition-all duration-150 p-1 -m-1 ${
          dragOver ? 'bg-blue-50 dark:bg-blue-900/10 ring-2 ring-blue-300 dark:ring-blue-700 ring-dashed' : ''
        }`}
      >
        {tasks.map((task) => (
          <TaskCard key={task._id} task={task} onClick={() => onTaskClick(task)} />
        ))}
        {tasks.length === 0 && (
          <div className={`flex items-center justify-center h-20 border-2 border-dashed rounded-xl transition-colors ${
            dragOver ? 'border-blue-300 dark:border-blue-600' : 'border-zinc-200 dark:border-zinc-800'
          }`}>
            <p className={`text-xs ${dragOver ? 'text-blue-400 dark:text-blue-500' : 'text-zinc-300 dark:text-zinc-600'}`}>
              {dragOver ? 'Drop here' : 'No tasks'}
            </p>
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
      <td className='px-4 py-3 w-8'>
        <div className={`w-1 h-8 rounded-full ${getPriority(task.priority).dot}`} />
      </td>
      <td className='px-2 py-3 max-w-[300px]'>
        <p className='font-medium text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate'>{task.title}</p>
        {task.tags.length > 0 && (
          <div className='flex gap-1 mt-0.5'>
            {task.tags.slice(0, 2).map((tag) => (
              <span key={tag} className='text-[10px] px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded'>#{tag}</span>
            ))}
          </div>
        )}
      </td>
      <td className='px-4 py-3'><PriorityBadge priority={task.priority} /></td>
      <td className='px-4 py-3'><StatusBadge status={task.status} /></td>
      <td className='px-4 py-3'>
        {task.assigned_to_names.length > 0 ? (
          <div className='flex items-center gap-2'>
            <AssigneeStack names={task.assigned_to_names} max={4} />
            <span className='text-xs text-zinc-500 dark:text-zinc-400 hidden lg:block truncate max-w-[120px]'>
              {task.assigned_to_names.slice(0, 2).join(', ')}{task.assigned_to_names.length > 2 ? ` +${task.assigned_to_names.length - 2}` : ''}
            </span>
          </div>
        ) : (
          <span className='text-xs text-zinc-300 dark:text-zinc-600 italic'>Unassigned</span>
        )}
      </td>
      <td className='px-4 py-3'>
        <span className={`text-xs font-medium ${overdue ? 'text-red-500' : 'text-zinc-500 dark:text-zinc-400'}`}>
          {fmtDate(task.deadline) ?? '—'}
        </span>
      </td>
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
    const map: Record<string, { user: AppUser | null; name: string; tasks: Task[] }> = {};
    tasks.forEach((task) => {
      if (task.assigned_to.length === 0) {
        if (!map['__unassigned']) map['__unassigned'] = { user: null, name: 'Unassigned', tasks: [] };
        map['__unassigned'].tasks.push(task);
      } else {
        task.assigned_to.forEach((uid, idx) => {
          const name = task.assigned_to_names[idx] ?? uid;
          if (!map[uid]) map[uid] = { user: users.find((u) => u._id === uid) ?? null, name, tasks: [] };
          if (!map[uid].tasks.find((t) => t._id === task._id)) map[uid].tasks.push(task);
        });
      }
    });
    return Object.entries(map).sort(([a], [b]) => {
      if (a === '__unassigned') return 1;
      if (b === '__unassigned') return -1;
      return map[a].name.localeCompare(map[b].name);
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
                {group.user && <p className='text-xs text-zinc-400'>{group.user.email}</p>}
              </div>
              <div className='flex items-center gap-2 text-xs flex-wrap justify-end'>
                <span className='font-bold text-zinc-700 dark:text-zinc-200'>{group.tasks.length} tasks</span>
                {STATUSES.map((s) => byStatus[s.value] > 0 && (
                  <span key={s.value} className={`px-2 py-0.5 rounded-full font-semibold ${s.bg} ${s.color}`}>{byStatus[s.value]} {s.label}</span>
                ))}
              </div>
            </div>
            {/* Completion bar */}
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
                    </div>
                    <div className='flex items-center gap-2 flex-shrink-0'>
                      <PriorityBadge priority={task.priority} />
                      <StatusBadge status={task.status} />
                      {task.deadline && (
                        <span className={`text-xs font-medium ${overdue ? 'text-red-500' : 'text-zinc-400'}`}>{fmtDate(task.deadline)}</span>
                      )}
                      {task.comments.length > 0 && (
                        <span className='flex items-center gap-0.5 text-xs text-zinc-400'><MessageSquare className='w-3 h-3' />{task.comments.length}</span>
                      )}
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
  const kpis = [
    { label: 'Total',       value: stats.total,                         color: 'text-zinc-800 dark:text-zinc-100' },
    { label: 'To Do',       value: stats.by_status['todo'] ?? 0,        color: 'text-zinc-500' },
    { label: 'In Progress', value: stats.by_status['in_progress'] ?? 0, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Review',      value: stats.by_status['review'] ?? 0,      color: 'text-purple-600 dark:text-purple-400' },
    { label: 'Done',        value: stats.by_status['done'] ?? 0,        color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Overdue',     value: stats.overdue,                       color: 'text-red-600 dark:text-red-400' },
  ];

  return (
    <div className='bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 mb-6'>
      <div className='flex items-center gap-2 mb-4'>
        <BarChart2 className='w-4 h-4 text-blue-500' />
        <h2 className='text-sm font-bold text-zinc-900 dark:text-zinc-100'>Overview</h2>
      </div>
      <div className='grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6'>
        {kpis.map((k) => (
          <div key={k.label} className='bg-zinc-50 dark:bg-zinc-800/60 rounded-xl p-3 text-center'>
            <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
            <p className='text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium'>{k.label}</p>
          </div>
        ))}
      </div>
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
  );
}

// ── Create / Edit Modal ───────────────────────────────────────────────────────

function TaskModal({ initial, designUsers, onClose, onSave }: {
  initial?: Partial<Task>;
  designUsers: AppUser[];
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const [title, setTitle]             = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [priority, setPriority]       = useState(initial?.priority ?? 'medium');
  const [taskStatus, setTaskStatus]   = useState(initial?.status ?? 'todo');
  const [assignedTo, setAssignedTo]   = useState<string[]>(initial?.assigned_to ?? []);
  const [assignedNames, setAssignedNames] = useState<string[]>(initial?.assigned_to_names ?? []);
  const [deadline, setDeadline]       = useState(initial?.deadline ? initial.deadline.slice(0, 10) : '');
  const [tags, setTags]               = useState(initial?.tags?.join(', ') ?? '');
  const [saving, setSaving]           = useState(false);

  const toggleUser = (u: AppUser) => {
    if (assignedTo.includes(u._id)) {
      setAssignedTo((p) => p.filter((id) => id !== u._id));
      setAssignedNames((p) => p.filter((n) => n !== u.name));
    } else {
      setAssignedTo((p) => [...p, u._id]);
      setAssignedNames((p) => [...p, u.name]);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      await onSave({
        title: title.trim(), description, priority, status: taskStatus,
        assigned_to: assignedTo, assigned_to_names: assignedNames,
        deadline: deadline || null,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
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
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder='Add context, requirements, or notes…'
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
            <label className='block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5'>
              Assign to <span className='font-normal text-zinc-400'>(Design team)</span>
            </label>
            {designUsers.length === 0 ? (
              <p className='text-xs text-zinc-400 italic'>No design team members found.</p>
            ) : (
              <div className='flex flex-wrap gap-2'>
                {designUsers.map((u) => {
                  const sel = assignedTo.includes(u._id);
                  return (
                    <button key={u._id} onClick={() => toggleUser(u)}
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
            )}
          </div>
          <div>
            <label className='block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1'>
              Tags <span className='font-normal text-zinc-400'>(comma-separated)</span>
            </label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder='e.g. packaging, revamp, logo'
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

// ── File Upload Area (supports drag and drop) ─────────────────────────────────

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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadFile(file);
  };

  const handleInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && fileRef.current?.click()}
      className={`flex flex-col items-center justify-center py-5 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
        dragOver
          ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.01]'
          : 'border-zinc-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
      }`}
    >
      <input ref={fileRef} type='file' className='hidden' onChange={handleInput} />
      {uploading
        ? <Loader2 className='w-5 h-5 text-blue-500 animate-spin mb-1' />
        : <Upload className={`w-5 h-5 mb-1 transition-colors ${dragOver ? 'text-blue-500' : 'text-zinc-300 dark:text-zinc-600'}`} />
      }
      <p className={`text-xs transition-colors ${dragOver ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-zinc-400'}`}>
        {uploading ? 'Uploading…' : dragOver ? 'Drop to upload' : 'Drop files here or click to browse'}
      </p>
    </div>
  );
}

// ── Task Drawer ───────────────────────────────────────────────────────────────

function TaskDrawer({ task: init, designUsers, currentUser, accessToken, onClose, onUpdate, onDelete }: {
  task: Task; designUsers: AppUser[]; currentUser: any; accessToken: string;
  onClose: () => void; onUpdate: (t: Task) => void; onDelete: (id: string) => void;
}) {
  const [task, setTask]               = useState(init);
  const [editing, setEditing]         = useState(false);
  const [activeTab, setActiveTab]     = useState<'details' | 'activity'>('details');
  const [comment, setComment]         = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [deletingCmt, setDeletingCmt] = useState<string | null>(null);
  const [deletingAtt, setDeletingAtt] = useState<string | null>(null);
  const [confirmDel, setConfirmDel]   = useState(false);
  const headers                       = { Authorization: `Bearer ${accessToken}` };

  const refresh = useCallback(async () => {
    const { data } = await axios.get(`${API}/tasks/${task._id}`, { headers });
    setTask(data);
    onUpdate(data);
  }, [task._id]);

  const patch = async (fields: Record<string, any>) => {
    const { data } = await axios.put(`${API}/tasks/${task._id}`, {
      ...fields, actor_id: currentUser._id, actor_name: currentUser.name,
    }, { headers });
    setTask(data);
    onUpdate(data);
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await axios.post(`${API}/tasks/${task._id}/comments`, {
        text: comment.trim(), author_id: currentUser._id, author_name: currentUser.name,
      }, { headers });
      setComment('');
      await refresh();
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

  const handleDeleteAtt = async (fileId: string) => {
    setDeletingAtt(fileId);
    try { await axios.delete(`${API}/tasks/${task._id}/attachments/${fileId}`, { headers }); await refresh(); }
    catch { toast.error('Failed to delete'); } finally { setDeletingAtt(null); }
  };

  const handleDeleteTask = async () => {
    try { await axios.delete(`${API}/tasks/${task._id}`, { headers }); onDelete(task._id); onClose(); toast.success('Task deleted'); }
    catch { toast.error('Failed to delete task'); }
  };

  const overdue = isOverdue(task.deadline, task.status);

  return (
    <>
      <div className='fixed inset-0 z-40 bg-black/30 backdrop-blur-sm' onClick={onClose} />
      <div className='fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white dark:bg-zinc-900 shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800'>

        {/* Header */}
        <div className='px-5 pt-4 pb-3 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0'>
          <div className='flex items-start gap-2 mb-2'>
            <div className='flex items-center gap-1.5 flex-wrap flex-1 min-w-0'>
              <PriorityBadge priority={task.priority} />
              <StatusBadge status={task.status} />
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
              {!confirmDel ? (
                <button onClick={() => setConfirmDel(true)} className='p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors'>
                  <Trash2 className='w-4 h-4' />
                </button>
              ) : (
                <div className='flex gap-1'>
                  <button onClick={handleDeleteTask} className='px-2.5 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg'>Delete</button>
                  <button onClick={() => setConfirmDel(false)} className='px-2.5 py-1.5 text-xs font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-500 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800'>Cancel</button>
                </div>
              )}
              <button onClick={onClose} className='p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors'>
                <X className='w-4 h-4' />
              </button>
            </div>
          </div>
          <h2 className='text-base font-bold text-zinc-900 dark:text-zinc-100 leading-snug mb-0.5'>{task.title}</h2>
          <p className='text-[10px] text-zinc-400'>Created by {task.created_by_name} · {fmtDateTime(task.created_at)}</p>
        </div>

        {/* Quick controls */}
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

        {/* Tabs */}
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
              {/* Assignees */}
              <div className='px-5 py-4 border-b border-zinc-100 dark:border-zinc-800'>
                <p className='text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-2'>Assignees</p>
                {task.assigned_to_names.length > 0 ? (
                  <div className='flex flex-wrap gap-2'>
                    {task.assigned_to_names.map((name, i) => (
                      <div key={name} className='flex items-center gap-2 px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg'>
                        <Avatar name={name} size='xs' />
                        <div>
                          <p className='text-xs font-semibold text-zinc-800 dark:text-zinc-200'>{name}</p>
                          {designUsers.find((u) => u._id === task.assigned_to[i])?.email && (
                            <p className='text-[10px] text-zinc-400'>{designUsers.find((u) => u._id === task.assigned_to[i])?.email}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <span className='text-xs text-zinc-400 italic'>Unassigned</span>}
              </div>

              {/* Deadline + Tags */}
              <div className='px-5 py-4 space-y-3.5 border-b border-zinc-100 dark:border-zinc-800'>
                <div>
                  <p className='text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1'>Deadline</p>
                  {task.deadline
                    ? <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${overdue ? 'text-red-500' : 'text-zinc-800 dark:text-zinc-100'}`}>
                        <Calendar className='w-3.5 h-3.5' />{fmtDate(task.deadline)}{overdue && <span className='text-xs text-red-500'>(Overdue)</span>}
                      </span>
                    : <span className='text-xs text-zinc-400 italic'>No deadline set</span>}
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

              {/* Description */}
              {task.description && (
                <div className='px-5 py-4 border-b border-zinc-100 dark:border-zinc-800'>
                  <p className='text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-2'>Description</p>
                  <p className='text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed'>{task.description}</p>
                </div>
              )}

              {/* Attachments */}
              <div className='px-5 py-4 border-b border-zinc-100 dark:border-zinc-800'>
                <p className='text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-3'>Attachments ({task.attachments.length})</p>
                {task.attachments.length > 0 && (
                  <div className='space-y-1.5 mb-3'>
                    {task.attachments.map((att) => {
                      const Icon = fileIcon(att.content_type);
                      return (
                        <div key={att.file_id} className='flex items-center gap-2.5 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 group hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors'>
                          <div className='w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0'>
                            <Icon className='w-4 h-4 text-zinc-500 dark:text-zinc-400' />
                          </div>
                          <div className='flex-1 min-w-0'>
                            <p className='text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate'>{att.filename}</p>
                            <p className='text-[10px] text-zinc-400'>{fmtBytes(att.size)} · {att.uploaded_by_name} · {fmtRelative(att.uploaded_at)}</p>
                          </div>
                          <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                            <button onClick={() => handleOpenAtt(att.file_id)} title='Open' className='p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'>
                              <Download className='w-3.5 h-3.5' />
                            </button>
                            <button onClick={() => handleDeleteAtt(att.file_id)} disabled={deletingAtt === att.file_id} title='Delete' className='p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-500'>
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

              {/* Comments */}
              <div className='px-5 py-4'>
                <p className='text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-3'>Comments ({task.comments.length})</p>
                <div className='space-y-4 mb-4'>
                  {task.comments.length === 0 && (
                    <p className='text-xs text-zinc-400 italic text-center py-4'>No comments yet. Start the conversation.</p>
                  )}
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
      </div>

      {editing && (
        <TaskModal initial={task} designUsers={designUsers} onClose={() => setEditing(false)}
          onSave={async (data) => { await patch(data); toast.success('Task updated'); }} />
      )}
    </>
  );
}

// ── Sort Bar ──────────────────────────────────────────────────────────────────

function SortBar({ sortBy, sortDir, onChange }: { sortBy: SortField; sortDir: SortDir; onChange: (f: SortField, d: SortDir) => void }) {
  return (
    <div className='flex items-center gap-1.5 flex-wrap'>
      <span className='text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mr-1'>Sort:</span>
      {SORT_OPTIONS.map((opt) => (
        <button key={opt.value}
          onClick={() => {
            if (sortBy === opt.value) onChange(opt.value, sortDir === 'asc' ? 'desc' : 'asc');
            else onChange(opt.value, opt.value === 'deadline' || opt.value === 'priority' ? 'asc' : 'desc');
          }}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
            sortBy === opt.value
              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm'
              : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
          }`}>
          {opt.label}
          {sortBy === opt.value && (sortDir === 'asc' ? <ChevronUp className='w-3 h-3' /> : <ChevronDown className='w-3 h-3' />)}
        </button>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DesignTasks() {
  const { accessToken, user: currentUser } = useAuth();
  const [tasks, setTasks]               = useState<Task[]>([]);
  const [allUsers, setAllUsers]         = useState<AppUser[]>([]);
  const [permissions, setPermissions]   = useState<Permission[]>([]);
  const [stats, setStats]               = useState<Stats | null>(null);
  const [loading, setLoading]           = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreate, setShowCreate]     = useState(false);
  const [showStats, setShowStats]       = useState(false);
  const [search, setSearch]             = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [activeStatus, setActiveStatus] = useState('');
  const [sortBy, setSortBy]             = useState<SortField>('created_at');
  const [sortDir, setSortDir]           = useState<SortDir>('desc');
  const [view, setView]                 = useState<ViewMode>('kanban');

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const headers = { Authorization: `Bearer ${accessToken}` };

  // Users who have at least one design_* permission → the "design team" (admins excluded from picker)
  const designUsers = useMemo<AppUser[]>(() => {
    const nonAdmins = allUsers.filter((u) => u.role !== 'admin');
    if (nonAdmins.length === 0 || permissions.length === 0) return nonAdmins;
    const designPermIds = new Set(permissions.filter((p) => p.name.startsWith(DESIGN_PERMISSION_PREFIX)).map((p) => p._id));
    const filtered = nonAdmins.filter((u) => u.permissions?.some((pid) => designPermIds.has(pid)));
    return filtered.length > 0 ? filtered : nonAdmins;
  }, [allUsers, permissions]);

  const fetchTasks = useCallback(async () => {
    if (!accessToken) return;
    try {
      const params: Record<string, string> = { sort_by: sortBy, sort_dir: sortDir };
      if (activeStatus)   params.status      = activeStatus;
      if (filterPriority) params.priority    = filterPriority;
      if (filterAssignee) params.assigned_to = filterAssignee;
      if (search)         params.search      = search;
      const { data } = await axios.get(`${API}/tasks`, { headers, params });
      setTasks(data);
    } catch { toast.error('Failed to load tasks'); }
  }, [accessToken, activeStatus, filterPriority, filterAssignee, search, sortBy, sortDir]);

  const fetchUsersAndPermissions = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [usersRes, permsRes] = await Promise.all([
        axios.get(`${API}/users`, { headers }),
        axios.get(`${API}/users/permissions`, { headers }),
      ]);
      setAllUsers(usersRes.data);
      setPermissions(permsRes.data);
    } catch { /* non-critical */ }
  }, [accessToken]);

  const fetchStats = useCallback(async () => {
    if (!accessToken || !isAdmin) return;
    try { const { data } = await axios.get(`${API}/tasks/stats`, { headers }); setStats(data); } catch { /* non-critical */ }
  }, [accessToken, isAdmin]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchTasks(), fetchUsersAndPermissions(), fetchStats()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTasks(); }, [activeStatus, filterPriority, filterAssignee, search, sortBy, sortDir]);

  const handleCreate = async (data: any) => {
    try {
      const { data: created } = await axios.post(`${API}/tasks`, {
        ...data, created_by: currentUser._id, created_by_name: currentUser.name,
      }, { headers });
      setTasks((p) => [created, ...p]);
      toast.success('Task created');
      if (isAdmin) fetchStats();
    } catch { toast.error('Failed to create task'); throw new Error('failed'); }
  };

  const handleUpdate = (updated: Task) => {
    setTasks((p) => p.map((t) => t._id === updated._id ? updated : t));
    if (selectedTask?._id === updated._id) setSelectedTask(updated);
    if (isAdmin) fetchStats();
  };

  const handleDelete = (id: string) => {
    setTasks((p) => p.filter((t) => t._id !== id));
    if (isAdmin) fetchStats();
  };

  // Called when a task card is dropped onto a kanban column
  const handleKanbanDrop = async (taskId: string, newStatus: string) => {
    const task = tasks.find((t) => t._id === taskId);
    if (!task || task.status === newStatus) return;
    // Optimistic update
    setTasks((p) => p.map((t) => t._id === taskId ? { ...t, status: newStatus as Task['status'] } : t));
    try {
      const { data } = await axios.put(`${API}/tasks/${taskId}`, {
        status: newStatus, actor_id: currentUser._id, actor_name: currentUser.name,
      }, { headers });
      setTasks((p) => p.map((t) => t._id === taskId ? data : t));
      if (selectedTask?._id === taskId) setSelectedTask(data);
      if (isAdmin) fetchStats();
    } catch {
      // Roll back optimistic update
      setTasks((p) => p.map((t) => t._id === taskId ? { ...t, status: task.status } : t));
      toast.error('Failed to move task');
    }
  };

  const tasksByStatus = (s: string) => tasks.filter((t) => t.status === s);

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-zinc-950'>
      {/* Top bar */}
      <div className='bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex-shrink-0'>
        <div className='flex items-center justify-between flex-wrap gap-3 mb-4'>
          <div>
            <h1 className='text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tight'>Design Tasks</h1>
            <p className='text-xs text-zinc-400 mt-0.5'>
              {tasks.length} tasks · {tasks.filter((t) => t.status !== 'done').length} open
              {designUsers.length > 0 && ` · ${designUsers.length} team members`}
            </p>
          </div>
          <div className='flex items-center gap-2'>
            {isAdmin && (
              <button
                onClick={() => { setShowStats((s) => !s); if (!showStats && !stats) fetchStats(); }}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                  showStats ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400'
                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
                <BarChart2 className='w-3.5 h-3.5' /> Overview
              </button>
            )}
            <button onClick={fetchTasks} className='p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors' title='Refresh'>
              <RefreshCw className='w-4 h-4' />
            </button>
            <button onClick={() => setShowCreate(true)} className='flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm'>
              <Plus className='w-4 h-4' /> New Task
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className='flex items-center gap-2 flex-wrap mb-3'>
          <div className='relative min-w-[160px] max-w-xs flex-1'>
            <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400' />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Search tasks…'
              className='w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500' />
          </div>

          <div className='flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5'>
            {[{ value: '', label: 'All' }, ...STATUSES].map((s) => (
              <button key={s.value} onClick={() => setActiveStatus(s.value)}
                className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition-all whitespace-nowrap ${
                  activeStatus === s.value ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}>
                {s.label}
                {s.value && <span className='ml-1 text-[10px] opacity-60'>({tasksByStatus(s.value).length})</span>}
              </button>
            ))}
          </div>

          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
            className='px-2.5 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500'>
            <option value=''>All priorities</option>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>

          <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}
            className='px-2.5 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500'>
            <option value=''>All assignees</option>
            {designUsers.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>

          <div className='flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 ml-auto'>
            {([
              ['kanban', LayoutGrid, 'Kanban'],
              ['list',   List,       'List'],
              ['assignee', Users,    'By Person'],
            ] as const).map(([v, Icon, label]) => (
              <button key={v} onClick={() => setView(v)} title={label}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                  view === v ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}>
                <Icon className='w-3.5 h-3.5' />
                <span className='hidden sm:inline'>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <SortBar sortBy={sortBy} sortDir={sortDir} onChange={(f, d) => { setSortBy(f); setSortDir(d); }} />
      </div>

      <div className='p-6'>
        {showStats && stats && <StatsPanel stats={stats} />}

        {loading ? (
          <div className='flex items-center justify-center py-32'><Loader2 className='w-8 h-8 animate-spin text-blue-500' /></div>
        ) : view === 'kanban' ? (
          <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 pb-6'>
            {STATUSES.map((s) => (
              <KanbanColumn key={s.value} statusDef={s} tasks={tasksByStatus(s.value)}
                onTaskClick={setSelectedTask} onDrop={handleKanbanDrop} onAddTask={() => setShowCreate(true)} />
            ))}
          </div>
        ) : view === 'list' ? (
          <div className='bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden'>
            {tasks.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-24 text-zinc-400'>
                <Flag className='w-8 h-8 mb-3 opacity-20' />
                <p className='text-sm font-medium'>No tasks found</p>
                <button onClick={() => setShowCreate(true)} className='mt-3 px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700'>Create your first task</button>
              </div>
            ) : (
              <table className='w-full'>
                <thead>
                  <tr className='border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60'>
                    <th className='w-8' />
                    <th className='text-left px-2 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider'>Task</th>
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
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <AssigneeView tasks={tasks} users={designUsers} onTaskClick={setSelectedTask} />
        )}
      </div>

      {selectedTask && (
        <TaskDrawer task={selectedTask} designUsers={designUsers} currentUser={currentUser}
          accessToken={accessToken!} onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdate} onDelete={handleDelete} />
      )}

      {showCreate && (
        <TaskModal designUsers={designUsers} onClose={() => setShowCreate(false)} onSave={handleCreate} />
      )}
    </div>
  );
}
