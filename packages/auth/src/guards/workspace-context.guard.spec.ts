import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { ResponseCode } from '@sociflow/common'
import { WorkspaceContextGuard } from './workspace-context.guard'

function makeExecCtx(req: any, handler: () => unknown = () => {}, klass: () => unknown = () => {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
      getNext: () => () => {},
    }),
    getHandler: () => handler,
    getClass: () => klass,
  } as unknown as ExecutionContext
}

describe('WorkspaceContextGuard', () => {
  let guard: WorkspaceContextGuard
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> }
  let ctx: { set: ReturnType<typeof vi.fn>, setWorkspaceId: ReturnType<typeof vi.fn> }
  let resolver: { findMembership: ReturnType<typeof vi.fn>, resolvePersonalWorkspaceId: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    reflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) }
    ctx = { set: vi.fn(), setWorkspaceId: vi.fn() }
    resolver = { findMembership: vi.fn(), resolvePersonalWorkspaceId: vi.fn() }

    guard = new WorkspaceContextGuard(reflector as unknown as Reflector, ctx as never, resolver as never)
  })

  it('bypasses public endpoint', async () => {
    reflector.getAllAndOverride.mockReturnValue(true)
    const req: any = { user: undefined }
    const result = await guard.canActivate(makeExecCtx(req))
    expect(result).toBe(true)
    expect(resolver.findMembership).not.toHaveBeenCalled()
  })

  it('throws AuthRequired if req.user missing on protected endpoint', async () => {
    const req: any = { headers: {} }
    await expect(guard.canActivate(makeExecCtx(req))).rejects.toMatchObject({
      code: ResponseCode.AuthRequired,
    })
  })

  it('accepts member with workspaceId from token claim', async () => {
    const req: any = {
      headers: {},
      user: { id: 'u1', email: 'a@b.com', role: 'USER', sessionId: 's1', workspaceId: 'wks_1' },
    }
    resolver.findMembership.mockResolvedValue({ role: 'EDITOR' })

    const result = await guard.canActivate(makeExecCtx(req))

    expect(result).toBe(true)
    expect(req.workspaceId).toBe('wks_1')
    expect(req.workspaceRole).toBe('EDITOR')
    expect(ctx.set).toHaveBeenCalledWith({ workspaceId: 'wks_1', workspaceRole: 'EDITOR' })
  })

  it('rejects non-member with WorkspaceAccessDenied', async () => {
    const req: any = {
      headers: {},
      user: { id: 'u1', email: 'a@b.com', role: 'USER', sessionId: 's1', workspaceId: 'wks_other' },
    }
    resolver.findMembership.mockResolvedValue(null)

    await expect(guard.canActivate(makeExecCtx(req))).rejects.toMatchObject({
      code: ResponseCode.WorkspaceAccessDenied,
    })
  })

  it('falls back to personal workspace when token has no workspaceId claim', async () => {
    const req: any = {
      headers: {},
      user: { id: 'u1', email: 'a@b.com', role: 'USER', sessionId: 's1' },
    }
    resolver.resolvePersonalWorkspaceId.mockResolvedValue('wks_personal')
    resolver.findMembership.mockResolvedValue({ role: 'OWNER' })

    await guard.canActivate(makeExecCtx(req))

    expect(resolver.resolvePersonalWorkspaceId).toHaveBeenCalledWith('u1')
    expect(req.workspaceId).toBe('wks_personal')
  })

  it('honors X-Workspace-Id header override after verifying membership', async () => {
    const req: any = {
      headers: { 'x-workspace-id': 'wks_other' },
      user: { id: 'u1', email: 'a@b.com', role: 'USER', sessionId: 's1', workspaceId: 'wks_1' },
    }
    resolver.findMembership.mockResolvedValue({ role: 'VIEWER' })

    await guard.canActivate(makeExecCtx(req))

    expect(resolver.findMembership).toHaveBeenCalledWith('u1', 'wks_other')
    expect(req.workspaceId).toBe('wks_other')
  })

  it('enforces @RequireWorkspaceRole — accepts ADMIN when ADMIN required', async () => {
    // 1st call: IS_PUBLIC_KEY (undefined), 2nd call: WORKSPACE_ROLE_KEY (ADMIN)
    reflector.getAllAndOverride
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('ADMIN')
    const req: any = {
      headers: {},
      user: { id: 'u1', email: 'a@b.com', role: 'USER', sessionId: 's1', workspaceId: 'wks_1' },
    }
    resolver.findMembership.mockResolvedValue({ role: 'ADMIN' })

    const result = await guard.canActivate(makeExecCtx(req))
    expect(result).toBe(true)
  })

  it('enforces @RequireWorkspaceRole — rejects EDITOR when ADMIN required', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('ADMIN')
    const req: any = {
      headers: {},
      user: { id: 'u1', email: 'a@b.com', role: 'USER', sessionId: 's1', workspaceId: 'wks_1' },
    }
    resolver.findMembership.mockResolvedValue({ role: 'EDITOR' })

    await expect(guard.canActivate(makeExecCtx(req))).rejects.toMatchObject({
      code: ResponseCode.WorkspaceInsufficientRole,
    })
  })
})
