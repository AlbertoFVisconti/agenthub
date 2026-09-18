import { useState, useEffect } from 'react'
import { LOCAL_API_BASE } from '@/lib/config'
import { Plus, MessageSquare, Folder, ChevronRight, ChevronDown, MoreVertical, Edit2, Trash2 } from 'lucide-react'

type Project = {
  id: string
  workspacePath: string
  title?: string
  conversations: Conversation[]
}

type Conversation = {
  id: string
  title: string
  updatedAt: string
}

export function Sidebar({
  currentConversationId,
  onSelectConversation,
  onNewChat,
  onNewProject,
  onNewChatInWorkspace,
  onDeleteWorkspace,
  onClearChat,
}: {
  currentConversationId: string | null
  onSelectConversation: (id: string, workspacePath: string) => void
  onNewChat: () => void
  onNewProject?: () => void
  onNewChatInWorkspace?: (workspacePath: string) => void
  onDeleteWorkspace?: (workspacePath: string) => void
  onClearChat?: () => void
}) {
  const [projects, setProjects] = useState<Project[]>([])
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingProjectTitle, setEditingProjectTitle] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, message: string, onConfirm: () => void } | null>(null)

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${LOCAL_API_BASE}/history/projects`)
      if (!res.ok) return
      const data = await res.json()
      setProjects(data.projects || [])
      setExpandedProjects(prev => {
        const next = new Set(prev)
        data.projects.forEach((p: Project) => { if (!prev.has(p.id) && prev.size === 0) next.add(p.id) })
        return next.size > 0 ? next : new Set(data.projects.map((p: Project) => p.id))
      })
    } catch (err) {
      console.error('Failed to fetch history', err)
    }
  }

  useEffect(() => {
    fetchHistory()
    const interval = setInterval(fetchHistory, 10000)
    return () => clearInterval(interval)
  }, [currentConversationId])

  const toggleProject = (id: string) => {
    const next = new Set(expandedProjects)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedProjects(next)
  }

  const handleRename = async (id: string, newTitle: string) => {
    // Optimistic update
    setProjects(projects.map(p => ({
      ...p,
      conversations: p.conversations.map(c => c.id === id ? { ...c, title: newTitle } : c)
    })))

    await fetch(`${LOCAL_API_BASE}/history/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim() })
    })
    fetchHistory()
  }

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      message: 'Are you sure you want to delete this chat?',
      onConfirm: async () => {
        setConfirmDialog(null)
        // Optimistic update
        setProjects(projects.map(p => ({
          ...p,
          conversations: p.conversations.filter(c => c.id !== id)
        })))
        
        if (currentConversationId === id) {
          if (onClearChat) onClearChat()
        }

        await fetch(`${LOCAL_API_BASE}/history/conversations/${id}`, {
          method: 'DELETE'
        })
        fetchHistory()
      }
    })
  }

  const handleDeleteWorkspace = async (workspacePath: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setConfirmDialog({
      isOpen: true,
      message: 'Are you sure you want to delete this workspace and all its chats?',
      onConfirm: async () => {
        setConfirmDialog(null)
        await fetch(`${LOCAL_API_BASE}/history/workspace`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspacePath })
        })
        
        // Clear current chat if it belongs to this workspace
        const project = projects.find(p => p.workspacePath === workspacePath)
        if (project && currentConversationId && project.conversations.some(c => c.id === currentConversationId)) {
          if (onDeleteWorkspace) onDeleteWorkspace(workspacePath)
        }
        fetchHistory()
      }
    })
  }

  const handleRenameWorkspace = async (project: Project, newTitle: string) => {
    if (!newTitle || newTitle.trim() === (project.title || formatPath(project.workspacePath))) {
      setEditingProjectId(null)
      return
    }

    await fetch(`${LOCAL_API_BASE}/history/workspace`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspacePath: project.workspacePath, title: newTitle.trim() })
    })
    setEditingProjectId(null)
    fetchHistory()
  }

  const formatPath = (path: string) => {
    if (path === 'default') return 'General'
    const parts = path.replace(/\\/g, '/').split('/')
    return parts[parts.length - 1] || path
  }

  return (
    <>
      <div style={{
      width: '260px',
      height: '100%',
      backgroundColor: 'rgba(10,10,20,0.8)',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ padding: '1rem' }}>
        <button
          onClick={onNewProject || onNewChat}
          style={{
            width: '100%', padding: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
            backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem'
          }}
        >
          <Folder size={16} /> New Project
        </button>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.5rem 1rem' }}>
        {projects.map(p => (
          <div key={p.id} style={{ marginBottom: '1rem' }}>
            <div 
              onClick={() => toggleProject(p.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem',
                cursor: 'pointer', color: 'hsl(220 15% 65%)', fontSize: '0.75rem', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.05em'
              }}
              onMouseEnter={(e) => {
                const btn = e.currentTarget.querySelector('.workspace-actions') as HTMLElement
                if (btn) btn.style.opacity = '1'
              }}
              onMouseLeave={(e) => {
                const btn = e.currentTarget.querySelector('.workspace-actions') as HTMLElement
                if (btn) btn.style.opacity = '0'
              }}
            >
              {expandedProjects.has(p.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Folder size={14} />
              {editingProjectId === p.id ? (
                <input
                  autoFocus
                  value={editingProjectTitle}
                  onChange={(e) => setEditingProjectTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRenameWorkspace(p, editingProjectTitle)
                    } else if (e.key === 'Escape') {
                      setEditingProjectId(null)
                    }
                  }}
                  onBlur={() => handleRenameWorkspace(p, editingProjectTitle)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex: 1, background: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid #818cf8',
                    borderRadius: '4px', padding: '0.1rem 0.3rem', fontSize: '0.75rem', outline: 'none'
                  }}
                />
              ) : (
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.title || formatPath(p.workspacePath)}
                </span>
              )}
              <div
                className="workspace-actions"
                style={{
                  display: 'flex', alignItems: 'center', opacity: 0, gap: '4px',
                  transition: 'opacity 0.2s'
                }}
              >
                {onNewChatInWorkspace && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onNewChatInWorkspace(p.workspacePath)
                    }}
                    style={{
                      background: 'none', border: 'none', color: 'hsl(220 15% 65%)',
                      cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center',
                    }}
                    title="New chat in this project"
                  >
                    <Plus size={13} />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingProjectTitle(p.title || formatPath(p.workspacePath))
                    setEditingProjectId(p.id)
                  }}
                  style={{
                    background: 'none', border: 'none', color: 'hsl(220 15% 65%)',
                    cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center',
                  }}
                  title="Rename project"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={(e) => handleDeleteWorkspace(p.workspacePath, e)}
                  style={{
                    background: 'none', border: 'none', color: '#ef4444',
                    cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center',
                  }}
                  title="Delete workspace and all chats"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            
            {expandedProjects.has(p.id) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                {p.conversations.map(c => (
                  <ConversationItem
                    key={c.id}
                    conversation={c}
                    isSelected={currentConversationId === c.id}
                    onClick={() => onSelectConversation(c.id, p.workspacePath)}
                    onRename={(newTitle) => handleRename(c.id, newTitle)}
                    onDelete={() => handleDelete(c.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        {projects.length === 0 && (
          <div style={{ padding: '1rem', color: 'hsl(220 15% 40%)', fontSize: '0.85rem', textAlign: 'center' }}>
            No chat history
          </div>
        )}
      </div>
      </div>
      
      {/* Custom Confirm Dialog */}
      {confirmDialog && confirmDialog.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#1e1e2d', padding: '1.5rem', borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)', minWidth: '300px'
          }}>
            <p style={{ color: '#e2e8f0', marginBottom: '1.5rem', fontSize: '0.95rem' }}>{confirmDialog.message}</p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setConfirmDialog(null)}
                style={{
                  background: 'none', border: '1px solid rgba(255,255,255,0.1)', 
                  color: '#e2e8f0', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer'
                }}>
                Cancel
              </button>
              <button 
                onClick={confirmDialog.onConfirm}
                style={{
                  background: '#ef4444', border: 'none', 
                  color: '#fff', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer'
                }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ConversationItem({
  conversation,
  isSelected,
  onClick,
  onRename,
  onDelete
}: {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
  onRename: (newTitle: string) => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(conversation.title)

  // Click outside to close menu
  useEffect(() => {
    const handler = () => setMenuOpen(false)
    if (menuOpen) window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [menuOpen])

  const handleSave = () => {
    if (!draftTitle.trim()) {
      setIsEditing(false)
      setDraftTitle(conversation.title)
      return
    }
    setIsEditing(false)
    if (draftTitle.trim() !== conversation.title) {
      onRename(draftTitle.trim())
    }
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        if (!isEditing) onClick()
      }}
      style={{
        padding: '0.5rem 0.5rem 0.5rem 1.8rem',
        cursor: 'pointer',
        fontSize: '0.85rem',
        color: isSelected ? '#fff' : 'hsl(220 15% 75%)',
        backgroundColor: isSelected ? 'rgba(255,255,255,0.1)' : 'transparent',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.5rem',
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
        <MessageSquare size={14} style={{ opacity: isSelected ? 1 : 0.5, flexShrink: 0 }} />
        
        {isEditing ? (
          <input 
            autoFocus
            value={draftTitle}
            onChange={e => setDraftTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') {
                setIsEditing(false)
                setDraftTitle(conversation.title)
              }
            }}
            onBlur={handleSave}
            onClick={e => e.stopPropagation()}
            style={{
              flex: 1, background: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid #818cf8',
              borderRadius: '4px', padding: '0.1rem 0.3rem', fontSize: '0.85rem', outline: 'none'
            }}
          />
        ) : (
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {conversation.title}
          </span>
        )}
      </div>

      {/* 3-dot Menu Trigger */}
      {(hovered || menuOpen) && !isEditing && (
        <div 
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen(!menuOpen)
          }}
          style={{
            padding: '0.1rem',
            borderRadius: '4px',
            background: menuOpen ? 'rgba(255,255,255,0.1)' : 'transparent',
            color: 'hsl(220 15% 75%)',
            flexShrink: 0
          }}
        >
          <MoreVertical size={14} />
        </div>
      )}

      {/* Popover */}
      {menuOpen && (
        <div 
          style={{
            position: 'absolute',
            right: '0.5rem',
            top: '2rem',
            background: '#1e1e24',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 10,
            padding: '0.25rem',
            display: 'flex',
            flexDirection: 'column',
            minWidth: '100px'
          }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen(false)
              setDraftTitle(conversation.title)
              setIsEditing(true)
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.4rem 0.5rem', background: 'transparent',
              border: 'none', color: '#fff', cursor: 'pointer',
              borderRadius: '4px', fontSize: '0.8rem', textAlign: 'left'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Edit2 size={12} /> Rename
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen(false)
              onDelete()
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.4rem 0.5rem', background: 'transparent',
              border: 'none', color: '#ef4444', cursor: 'pointer',
              borderRadius: '4px', fontSize: '0.8rem', textAlign: 'left'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}
    </div>
  )
}
