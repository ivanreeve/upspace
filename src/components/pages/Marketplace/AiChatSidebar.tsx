'use client';

import React from 'react';
import {
  FiPlus,
  FiTrash2,
  FiEdit2,
  FiMessageSquare,
  FiMoreHorizontal,
  FiCheck,
  FiX
} from 'react-icons/fi';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  useAiConversationsQuery,
  useDeleteAiConversationMutation,
  useRenameAiConversationMutation,
  type AiConversationSummary
} from '@/hooks/api/useAiConversations';
import { cn } from '@/lib/utils';

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: {
  conversation: AiConversationSummary;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleStartRename = () => {
    setRenameValue(conversation.title ?? '');
    setIsRenaming(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleConfirmRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== conversation.title) {
      onRename(trimmed);
    }
    setIsRenaming(false);
  };

  const handleCancelRename = () => {
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleConfirmRename();
    } else if (event.key === 'Escape') {
      handleCancelRename();
    }
  };

  return (
    <div
      onClick={ () => {
        if (!isRenaming) {
          onSelect();
        }
      } }
      className={ cn(
        'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors',
        isActive
          ? 'bg-primary/10 text-foreground'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      ) }
    >
      <FiMessageSquare className="size-4 shrink-0" aria-hidden="true" />

      { isRenaming ? (
        <div className="flex flex-1 items-center gap-1">
          <Input
            ref={ inputRef }
            value={ renameValue }
            onChange={ (event) => setRenameValue(event.target.value) }
            onKeyDown={ handleRenameKeyDown }
            onClick={ (event) => event.stopPropagation() }
            className="h-6 px-1 text-xs"
            aria-label="Rename conversation"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-5"
            onClick={ handleConfirmRename }
            onMouseDown={ (event) => event.stopPropagation() }
            aria-label="Confirm rename"
          >
            <FiCheck className="size-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-5"
            onClick={ handleCancelRename }
            onMouseDown={ (event) => event.stopPropagation() }
            aria-label="Cancel rename"
          >
            <FiX className="size-3" />
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col items-start gap-0.5 overflow-hidden text-left">
            <span className="w-full truncate text-xs font-medium">
              { conversation.title ?? 'New conversation' }
            </span>
            <span className="text-[10px] text-muted-foreground">
              { formatRelativeTime(conversation.updated_at) }
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:!bg-sidebar focus-visible:!bg-sidebar data-[state=open]:!bg-sidebar dark:hover:!bg-accent/50 dark:focus-visible:!bg-accent/50 dark:data-[state=open]:!bg-accent/50"
                onClick={ (event) => event.stopPropagation() }
                aria-label="Conversation options"
              >
                <FiMoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36 bg-popover p-1">
              <DropdownMenuItem
                onClick={ handleStartRename }
                className="data-[highlighted]:bg-[oklch(0.955_0.02_204.6929)] focus-visible:bg-[oklch(0.955_0.02_204.6929)] dark:data-[highlighted]:bg-[oklch(0.24_0.02_204.6929)] dark:focus-visible:bg-[oklch(0.24_0.02_204.6929)] data-[highlighted]:text-primary data-[highlighted]:[&_svg]:text-primary dark:data-[highlighted]:text-secondary dark:data-[highlighted]:[&_svg]:text-secondary hover:!text-primary hover:[&_svg]:!text-primary dark:hover:!text-secondary dark:hover:[&_svg]:!text-secondary"
              >
                <FiEdit2 className="mr-2 size-3.5" aria-hidden="true" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={ onDelete }
                className="text-destructive focus-visible:text-destructive data-[highlighted]:bg-[oklch(0.9647_0.0345_19.81)] focus-visible:bg-[oklch(0.9647_0.0345_19.81)] dark:data-[highlighted]:bg-[oklch(0.24_0.04_19.81)] dark:focus-visible:bg-[oklch(0.24_0.04_19.81)] data-[highlighted]:text-destructive data-[highlighted]:[&_svg]:text-destructive hover:bg-[oklch(0.9647_0.0345_19.81)] dark:hover:bg-[oklch(0.24_0.04_19.81)] hover:text-destructive hover:[&_svg]:text-destructive"
              >
                <FiTrash2 className="mr-2 size-3.5" aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) }
    </div>
  );
}

export function AiChatSidebar({
  activeConversationId,
  onSelectConversation,
  onNewConversation,
}: {
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}) {
  const {
    data: conversations,
    isLoading,
  } = useAiConversationsQuery();
  const deleteMutation = useDeleteAiConversationMutation();
  const renameMutation = useRenameAiConversationMutation();
  const [deleteTarget, setDeleteTarget] = React.useState<AiConversationSummary | null>(null);

  const handleDelete = (conversation: AiConversationSummary) => {
    setDeleteTarget(conversation);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;

    const deletedId = deleteTarget.id;
    deleteMutation.mutate(deletedId, {
      onSuccess: () => {
        if (activeConversationId === deletedId) {
          onNewConversation();
        }
        setDeleteTarget(null);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  const handleRename = (id: string, title: string) => {
    renameMutation.mutate({
 id,
title, 
}, {
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  return (
    <>
      <div className="flex h-full w-64 flex-col border-r border-border/50 bg-background">
        <div className="flex items-center justify-between border-b border-border/50 px-3 py-3">
          <span className="text-sm font-semibold">Chats</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={ onNewConversation }
            aria-label="New conversation"
          >
            <FiPlus className="size-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            { isLoading ? (
              <div className="space-y-2 px-2 py-1">
                { Array.from({ length: 4, }).map((_, index) => (
                  <div
                    key={ `skeleton-${index}` }
                    className="h-10 animate-pulse rounded-md bg-muted/40"
                  />
                )) }
              </div>
            ) : conversations && conversations.length > 0 ? (
              conversations.map((conversation) => (
                <ConversationItem
                  key={ conversation.id }
                  conversation={ conversation }
                  isActive={ conversation.id === activeConversationId }
                  onSelect={ () => onSelectConversation(conversation.id) }
                  onDelete={ () => handleDelete(conversation) }
                  onRename={ (title) => handleRename(conversation.id, title) }
                />
              ))
            ) : (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                No conversations yet. Start a new chat!
              </p>
            ) }
          </div>
        </ScrollArea>
      </div>

      <Dialog
        open={ Boolean(deleteTarget) }
        onOpenChange={ (open) => {
          if (!open) setDeleteTarget(null);
        } }
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete conversation</DialogTitle>
            <DialogDescription className="pb-2">
              Are you sure you want to delete{ ' ' }
              <span className="font-medium">
                { deleteTarget?.title ?? 'this conversation' }
              </span>
              ? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={ () => setDeleteTarget(null) }
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={ handleConfirmDelete }
              disabled={ deleteMutation.isPending }
            >
              { deleteMutation.isPending ? 'Deleting...' : 'Delete' }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
