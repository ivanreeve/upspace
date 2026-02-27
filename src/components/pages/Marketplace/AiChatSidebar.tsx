'use client';

import React from 'react';
import {
  FiPlus,
  FiTrash2,
  FiEdit2,
  FiMessageSquare,
  FiMoreHorizontal,
  FiCheck,
  FiX,
  FiMenu
} from 'react-icons/fi';
import { CgSpinner } from 'react-icons/cg';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  const handleItemKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isRenaming) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      role="button"
      tabIndex={ isRenaming ? -1 : 0 }
      onClick={ () => {
        if (!isRenaming) {
          onSelect();
        }
      } }
      onKeyDown={ handleItemKeyDown }
      className={ cn(
        'group flex min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors',
        isActive
          ? 'bg-primary/8 text-foreground'
          : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
      ) }
    >
      <FiMessageSquare className="size-3.5 shrink-0" aria-hidden="true" />

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
                className="size-5 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-muted/50 data-[state=open]:bg-muted/50 dark:hover:bg-muted/40 dark:data-[state=open]:bg-muted/40"
                onClick={ (event) => event.stopPropagation() }
                aria-label="Conversation options"
              >
                <FiMoreHorizontal className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36 bg-popover p-1">
              <DropdownMenuItem
                onClick={ handleStartRename }
                className="data-[highlighted]:bg-primary/8 data-[highlighted]:text-primary dark:data-[highlighted]:bg-secondary/15 dark:data-[highlighted]:text-secondary"
              >
                <FiEdit2 className="mr-2 size-3.5 text-current" aria-hidden="true" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={ onDelete }
                className="text-destructive data-[highlighted]:bg-destructive/8 data-[highlighted]:text-destructive data-[highlighted]:[&_svg]:text-destructive focus-visible:[&_svg]:text-destructive dark:data-[highlighted]:bg-destructive/15"
              >
                <FiTrash2 className="mr-2 size-3.5 text-destructive" aria-hidden="true" />
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
  const [open, setOpen] = React.useState(false);

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

  const handleSelectAndClose = (id: string) => {
    onSelectConversation(id);
    setOpen(false);
  };

  const handleNewAndClose = () => {
    onNewConversation();
    setOpen(false);
  };

  return (
    <>
      <Popover open={ open } onOpenChange={ setOpen }>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="rounded-full gap-2 px-4"
            aria-label={ open ? 'Close chat history' : 'Open chat history' }
          >
            <FiMenu className="size-4" aria-hidden="true" />
            <span className="text-sm font-medium">History</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={ 8 }
          className="w-72 rounded-xl border border-border/60 bg-popover p-0"
        >
          <div className="flex items-center justify-between border-b border-border/40 px-3.5 py-2.5">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Chats
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 rounded-md text-muted-foreground hover:bg-[oklch(0.955_0.02_204.6929)] dark:hover:bg-[oklch(0.24_0.02_204.6929)] hover:text-foreground"
              onClick={ handleNewAndClose }
              aria-label="New conversation"
            >
              <FiPlus className="size-3.5" />
            </Button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            <div className="space-y-0.5 p-1.5">
              { isLoading ? (
                <div className="space-y-1.5 px-2 py-1">
                  { Array.from({ length: 4, }).map((_, index) => (
                    <div
                      key={ `skeleton-${index}` }
                      className="h-10 animate-pulse rounded-lg bg-muted/30"
                    />
                  )) }
                </div>
              ) : conversations && conversations.length > 0 ? (
                conversations.map((conversation) => (
                  <ConversationItem
                    key={ conversation.id }
                    conversation={ conversation }
                    isActive={ conversation.id === activeConversationId }
                    onSelect={ () => handleSelectAndClose(conversation.id) }
                    onDelete={ () => handleDelete(conversation) }
                    onRename={ (title) => handleRename(conversation.id, title) }
                  />
                ))
              ) : (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                  No conversations yet
                </p>
              ) }
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog
        open={ Boolean(deleteTarget) }
        onOpenChange={ (dialogOpen) => {
          if (!dialogOpen) setDeleteTarget(null);
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
              { deleteMutation.isPending && (
                <CgSpinner className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) }
              { deleteMutation.isPending ? 'Deleting...' : 'Delete' }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
