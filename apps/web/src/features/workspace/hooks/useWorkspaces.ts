'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getCurrentWorkspaceId, setCurrentWorkspaceId } from '@/lib/api/client'
import { workspaceService } from '../services/workspace.service'
import type { InviteMemberInput } from '../types'

export const workspaceKeys = {
  all: ['workspaces'] as const,
  list: () => [...workspaceKeys.all, 'list'] as const,
  current: () => [...workspaceKeys.all, 'current'] as const,
  members: (id: string) => [...workspaceKeys.all, id, 'members'] as const,
}

export function useWorkspaces() {
  return useQuery({
    queryKey: workspaceKeys.list(),
    queryFn: workspaceService.list,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCurrentWorkspace() {
  return useQuery({
    queryKey: workspaceKeys.current(),
    queryFn: workspaceService.getCurrent,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSwitchWorkspace() {
  const qc = useQueryClient()
  return (workspaceId: string) => {
    setCurrentWorkspaceId(workspaceId)
    // Invalidate mọi server-state vì tenant context đổi
    qc.invalidateQueries()
  }
}

export function useCurrentWorkspaceId(): string | null {
  // Local helper — không reactive trong React, dùng cho non-component context
  return getCurrentWorkspaceId()
}

export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: workspaceKeys.members(workspaceId ?? ''),
    queryFn: () => workspaceService.listMembers(workspaceId!),
    enabled: !!workspaceId,
  })
}

export function useInviteMember(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: InviteMemberInput) => workspaceService.inviteMember(workspaceId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) })
    },
  })
}

export function useCreateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => workspaceService.create(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workspaceKeys.list() })
    },
  })
}
