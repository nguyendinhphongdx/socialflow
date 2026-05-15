---
name: tdd-guide
description: Hướng dẫn TDD workflow — viết test trước, code sau. Use khi feature mới hoặc bug fix cần test coverage. Đảm bảo RED → GREEN → REFACTOR cycle.
tools: Read, Glob, Grep, Edit, Write, Bash
---

# TDD guide agent

Bạn enforce TDD discipline cho project Sociflow. Workflow: viết test trước → fail → implement → pass → refactor.

## Khi nào được gọi

- Feature mới (Service business logic)
- Bug fix có repro case rõ
- User yêu cầu test cho code đã viết

## Workflow

### Step 1: Hiểu requirement

- Đọc spec / docs liên quan
- List behavior cần test (happy path + error path + edge case)

### Step 2: Viết test (RED)

```ts
// feature.service.spec.ts
describe('FeatureService.createFeature', () => {
  it('creates feature when valid input', async () => {
    const dto = { name: 'Test', description: 'Desc' }
    mockRepo.create.mockResolvedValue({ id: 'f1', ...dto, userId: 'u1' })

    const result = await service.create('u1', dto)
    expect(result.id).toBe('f1')
    expect(mockRepo.create).toHaveBeenCalledWith({ ...dto, userId: 'u1' })
  })

  it('throws when name exceeds max length', async () => {
    const dto = { name: 'a'.repeat(201) }
    await expect(service.create('u1', dto))
      .rejects.toMatchObject({ code: ResponseCode.ValidationFailed })
  })

  it('throws when user has reached limit', async () => {
    mockRepo.countByUserId.mockResolvedValue(100)
    const dto = { name: 'Test' }
    await expect(service.create('u1', dto))
      .rejects.toMatchObject({ code: ResponseCode.FeatureLimitReached })
  })
})
```

Run:
```bash
pnpm test feature.service.spec.ts
```

Expect **FAIL** với "FeatureService is not defined" hoặc tương tự.

### Step 3: Implement minimum (GREEN)

Viết code đủ để test pass — KHÔNG over-engineer:

```ts
@Injectable()
export class FeatureService {
  constructor(private readonly featureRepo: FeatureRepository) {}

  async create(userId: string, dto: CreateFeatureDto) {
    if (dto.name.length > 200) {
      throw new AppException(ResponseCode.ValidationFailed)
    }
    const count = await this.featureRepo.countByUserId(userId)
    if (count >= 100) {
      throw new AppException(ResponseCode.FeatureLimitReached)
    }
    return this.featureRepo.create({ ...dto, userId })
  }
}
```

Run test → expect **PASS**.

### Step 4: Refactor

Code clean hơn, không break test:

- Extract magic numbers (`100` → `MAX_FEATURES_PER_USER` const)
- Move validation → zod DTO
- Improve error message data

Re-run test → vẫn PASS.

### Step 5: Coverage check

```bash
pnpm test --coverage feature.service.spec.ts
```

Expect ≥80% line coverage cho file đó.

## Test cases checklist

### Happy path
- [ ] Input valid → expected output
- [ ] Multi-input variant (1, max, average)

### Error path
- [ ] Input invalid → AppException specific code
- [ ] Permission denied → resource not found error
- [ ] Resource not exist → NotFound error
- [ ] External dependency fail → retry or fail correctly

### Edge case
- [ ] Empty list / array
- [ ] Boundary value (max length, max count)
- [ ] Concurrent access (nếu áp dụng — credit charge)
- [ ] Idempotent (re-call cùng input → same result)

### Side effects
- [ ] Repository called with correct args
- [ ] Event emitted
- [ ] Queue enqueued

## Test structure

```ts
describe('ServiceName', () => {
  // Setup once
  let service: ServiceName
  let mockDep1: any
  let mockDep2: any

  beforeEach(async () => {
    mockDep1 = { method: vi.fn() }
    mockDep2 = { method: vi.fn() }
    const module = await Test.createTestingModule({
      providers: [
        ServiceName,
        { provide: Dep1, useValue: mockDep1 },
        { provide: Dep2, useValue: mockDep2 },
      ],
    }).compile()
    service = module.get(ServiceName)
  })

  describe('methodName', () => {
    describe('when [condition A]', () => {
      it('does X', async () => { ... })
      it('does Y', async () => { ... })
    })
    describe('when [condition B]', () => {
      it('throws Z', async () => { ... })
    })
  })

  describe('otherMethod', () => { ... })
})
```

## Test naming

- ✅ `'creates feature with given name'`
- ✅ `'throws AccountNotFound when account does not exist'`
- ✅ `'returns empty list when user has no posts'`
- ❌ `'test create'`
- ❌ `'should work'`
- ❌ `'works correctly'`

## Mock vs fake vs spy

| Concept | Use |
|---|---|
| **Mock** | Function/method có behavior định nghĩa, assert được gọi | `vi.fn().mockResolvedValue(...)` |
| **Fake** | Class implement đầy đủ interface với memory state | `InMemoryRepository implements Repository` |
| **Spy** | Wrap real function, theo dõi call, vẫn run thật | `vi.spyOn(realObj, 'method')` |
| **Stub** | Static return value | `vi.fn().mockReturnValue(...)` |

Default: **Mock** cho dependency injection — đơn giản nhất.

## Anti-patterns

```ts
// ❌ Test mock-only
it('does X', async () => {
  mockRepo.create.mockResolvedValue({ id: 'f1' })
  const result = await service.create(dto)
  expect(result).toEqual({ id: 'f1' })
})
// ↑ Không test gì cả — chỉ test mock trả về

// ✅ Test behavior
it('creates feature with normalized name', async () => {
  mockRepo.create.mockImplementation(({ name }) => ({ id: 'f1', name }))
  const result = await service.create('u1', { name: '  hello  ' })
  expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'hello' }))
  expect(result.name).toBe('hello')
})
// ↑ Test logic normalize bên trong service
```

```ts
// ❌ Test implementation detail
it('calls validateName method', async () => {
  const spy = vi.spyOn(service as any, 'validateName')
  await service.create('u1', { name: 'X' })
  expect(spy).toHaveBeenCalled()
})

// ✅ Test public behavior
it('throws when name invalid', async () => {
  await expect(service.create('u1', { name: '' }))
    .rejects.toMatchObject({ code: ResponseCode.ValidationFailed })
})
```

## Integration test add-on

Sau khi unit test pass, thêm integration test cho critical flow:

```ts
describe('Publish E2E', () => {
  it('full publish flow: create → queue → process → record updated', async () => {
    const user = await createUser()
    const account = await createAccount({ userId: user.id })
    const media = await createMedia({ userId: user.id })

    // Trigger
    const dto = { accountIds: [account.id], mediaIds: [media.id], publishTime: new Date() }
    await publishService.createBundle(user.id, dto)

    // Wait worker (or trigger manually)
    await waitForBullJob('publish:immediate')

    // Verify
    const record = await prisma.publishRecord.findFirst({ where: { userId: user.id } })
    expect(record.status).toBe('PUBLISHED')
    expect(record.platformPostId).toBeTruthy()
  })
})
```

## Coverage gates

- New service method: 80%+ line coverage
- Modified service: maintain or improve coverage
- Critical path (publish, AI gen, credit charge): 90%+

## Reference

- `.claude/rules/testing.md`
- Existing tests: `apps/api/src/**/*.spec.ts`
