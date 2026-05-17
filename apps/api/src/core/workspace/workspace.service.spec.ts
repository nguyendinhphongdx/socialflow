import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Workspace, WorkspaceMember } from '@prisma/client'
import { ResponseCode } from '@sociflow/common'
import { WorkspaceService } from './workspace.service'

function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  const now = new Date()
  return {
    id: 'wks_1',
    name: 'Test workspace',
    slug: 'test-ws',
    isPersonal: false,
    ownerId: 'user_owner',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

function makeMember(overrides: Partial<WorkspaceMember> = {}): WorkspaceMember {
  return {
    id: 'wm_1',
    workspaceId: 'wks_1',
    userId: 'user_member',
    role: 'EDITOR',
    invitedBy: null,
    joinedAt: new Date(),
    ...overrides,
  }
}

describe('WorkspaceService', () => {
  let service: WorkspaceService
  let repo: {
    getById: ReturnType<typeof vi.fn>
    getBySlug: ReturnType<typeof vi.fn>
    getPersonalByOwnerId: ReturnType<typeof vi.fn>
    findMembership: ReturnType<typeof vi.fn>
    listMembershipsByUserId: ReturnType<typeof vi.fn>
    listMembersByWorkspaceId: ReturnType<typeof vi.fn>
    countMembersByWorkspaceId: ReturnType<typeof vi.fn>
    createWithOwner: ReturnType<typeof vi.fn>
    updateById: ReturnType<typeof vi.fn>
    softDeleteById: ReturnType<typeof vi.fn>
    addMember: ReturnType<typeof vi.fn>
    updateMemberRole: ReturnType<typeof vi.fn>
    removeMember: ReturnType<typeof vi.fn>
  }
  let userRepo: { getByEmail: ReturnType<typeof vi.fn> }
  let ctx: {
    requireUserId: ReturnType<typeof vi.fn>
    requireWorkspaceId: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    repo = {
      getById: vi.fn(),
      getBySlug: vi.fn().mockResolvedValue(null),
      getPersonalByOwnerId: vi.fn(),
      findMembership: vi.fn(),
      listMembershipsByUserId: vi.fn(),
      listMembersByWorkspaceId: vi.fn(),
      countMembersByWorkspaceId: vi.fn(),
      createWithOwner: vi.fn(),
      updateById: vi.fn(),
      softDeleteById: vi.fn(),
      addMember: vi.fn(),
      updateMemberRole: vi.fn(),
      removeMember: vi.fn(),
    }
    userRepo = { getByEmail: vi.fn() }
    ctx = {
      requireUserId: vi.fn().mockReturnValue('user_owner'),
      requireWorkspaceId: vi.fn().mockReturnValue('wks_1'),
    }

    service = new WorkspaceService(repo as never, userRepo as never, ctx as never)
  })

  describe('ensurePersonalWorkspace', () => {
    it('returns existing personal workspace if user already has one (idempotent)', async () => {
      const existing = makeWorkspace({ isPersonal: true, ownerId: 'user_1' })
      repo.getPersonalByOwnerId.mockResolvedValue(existing)

      const result = await service.ensurePersonalWorkspace('user_1', 'Alice')

      expect(result).toBe(existing)
      expect(repo.createWithOwner).not.toHaveBeenCalled()
    })

    it('creates new personal workspace with slug + OWNER membership', async () => {
      repo.getPersonalByOwnerId.mockResolvedValue(null)
      const created = makeWorkspace({ id: 'wks_new', isPersonal: true, ownerId: 'user_1' })
      repo.createWithOwner.mockResolvedValue(created)

      const result = await service.ensurePersonalWorkspace('user_1', 'Alice')

      expect(result.id).toBe('wks_new')
      expect(repo.createWithOwner).toHaveBeenCalledWith(expect.objectContaining({
        isPersonal: true,
        ownerId: 'user_1',
        name: expect.stringContaining('Alice'),
      }))
    })
  })

  describe('findMembership (WorkspaceMembershipResolver)', () => {
    it('returns role when membership exists', async () => {
      repo.findMembership.mockResolvedValue(makeMember({ role: 'ADMIN' }))
      const result = await service.findMembership('user_1', 'wks_1')
      expect(result).toEqual({ role: 'ADMIN' })
    })

    it('returns null when not a member', async () => {
      repo.findMembership.mockResolvedValue(null)
      const result = await service.findMembership('user_1', 'wks_1')
      expect(result).toBeNull()
    })
  })

  describe('createTeamWorkspace', () => {
    it('creates team workspace as OWNER', async () => {
      const created = makeWorkspace({ id: 'wks_team', isPersonal: false, slug: 'team-x' })
      repo.createWithOwner.mockResolvedValue(created)

      const result = await service.createTeamWorkspace({ name: 'Team', slug: 'team-x' })

      expect(result.id).toBe('wks_team')
      expect(repo.createWithOwner).toHaveBeenCalledWith({
        name: 'Team',
        slug: 'team-x',
        isPersonal: false,
        ownerId: 'user_owner',
      })
    })

    it('rejects when slug already taken', async () => {
      repo.getBySlug.mockResolvedValue(makeWorkspace({ slug: 'taken' }))
      await expect(service.createTeamWorkspace({ name: 'X', slug: 'taken' }))
        .rejects.toMatchObject({ code: ResponseCode.WorkspaceMemberAlreadyExists })
    })
  })

  describe('inviteMember', () => {
    it('invites existing user as EDITOR by default', async () => {
      repo.findMembership.mockResolvedValueOnce(makeMember({ role: 'ADMIN', userId: 'user_owner' })) // role check
      userRepo.getByEmail.mockResolvedValue({ id: 'user_invitee', email: 'b@x.com' })
      repo.findMembership.mockResolvedValueOnce(null) // not yet member
      repo.addMember.mockResolvedValue(makeMember({ userId: 'user_invitee', role: 'EDITOR' }))

      const result = await service.inviteMember('wks_1', { email: 'b@x.com', role: 'EDITOR' })

      expect(result.userId).toBe('user_invitee')
      expect(repo.addMember).toHaveBeenCalledWith(expect.objectContaining({
        workspaceId: 'wks_1',
        userId: 'user_invitee',
        role: 'EDITOR',
      }))
    })

    it('throws UserNotFound if invitee email not registered', async () => {
      repo.findMembership.mockResolvedValueOnce(makeMember({ role: 'OWNER' }))
      userRepo.getByEmail.mockResolvedValue(null)
      await expect(service.inviteMember('wks_1', { email: 'noone@x.com', role: 'EDITOR' }))
        .rejects.toMatchObject({ code: ResponseCode.UserNotFound })
    })

    it('throws WorkspaceMemberAlreadyExists when already member', async () => {
      repo.findMembership.mockResolvedValueOnce(makeMember({ role: 'ADMIN' }))
      userRepo.getByEmail.mockResolvedValue({ id: 'user_dup', email: 'dup@x.com' })
      repo.findMembership.mockResolvedValueOnce(makeMember({ userId: 'user_dup' }))
      await expect(service.inviteMember('wks_1', { email: 'dup@x.com', role: 'EDITOR' }))
        .rejects.toMatchObject({ code: ResponseCode.WorkspaceMemberAlreadyExists })
    })

    it('throws WorkspaceInsufficientRole when caller is VIEWER', async () => {
      repo.findMembership.mockResolvedValueOnce(makeMember({ role: 'VIEWER' }))
      await expect(service.inviteMember('wks_1', { email: 'x@x.com', role: 'EDITOR' }))
        .rejects.toMatchObject({ code: ResponseCode.WorkspaceInsufficientRole })
    })
  })

  describe('removeMember', () => {
    it('removes EDITOR member when called by ADMIN', async () => {
      repo.findMembership
        .mockResolvedValueOnce(makeMember({ role: 'ADMIN', userId: 'user_owner' }))     // actor
        .mockResolvedValueOnce(makeMember({ role: 'EDITOR', userId: 'user_target' }))   // target

      await service.removeMember('wks_1', 'user_target')

      expect(repo.removeMember).toHaveBeenCalledWith('wks_1', 'user_target')
    })

    it('refuses to remove OWNER (force transfer flow instead)', async () => {
      repo.findMembership
        .mockResolvedValueOnce(makeMember({ role: 'ADMIN' }))
        .mockResolvedValueOnce(makeMember({ role: 'OWNER' }))

      await expect(service.removeMember('wks_1', 'user_owner'))
        .rejects.toMatchObject({ code: ResponseCode.WorkspaceInsufficientRole })
      expect(repo.removeMember).not.toHaveBeenCalled()
    })
  })

  describe('softDeleteById', () => {
    it('refuses to delete personal workspace', async () => {
      repo.getById.mockResolvedValue(makeWorkspace({ isPersonal: true }))
      await expect(service.softDeleteById('wks_1'))
        .rejects.toMatchObject({ code: ResponseCode.WorkspaceCannotDeletePersonal })
      expect(repo.softDeleteById).not.toHaveBeenCalled()
    })

    it('soft-deletes team workspace when called by OWNER', async () => {
      repo.getById.mockResolvedValue(makeWorkspace({ isPersonal: false }))
      repo.findMembership.mockResolvedValue(makeMember({ role: 'OWNER' }))

      await service.softDeleteById('wks_1')

      expect(repo.softDeleteById).toHaveBeenCalledWith('wks_1')
    })

    it('refuses when caller not OWNER', async () => {
      repo.getById.mockResolvedValue(makeWorkspace({ isPersonal: false }))
      repo.findMembership.mockResolvedValue(makeMember({ role: 'ADMIN' }))

      await expect(service.softDeleteById('wks_1'))
        .rejects.toMatchObject({ code: ResponseCode.WorkspaceInsufficientRole })
    })
  })
})
