import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const admin = await prisma.user.upsert({
    where: { email: 'admin@sociflow.local' },
    update: {},
    create: {
      email: 'admin@sociflow.local',
      emailVerified: true,
      name: 'Sociflow Admin',
      role: 'ADMIN',
      locale: 'vi',
    },
  })

  console.log(`✓ Admin user: ${admin.email} (${admin.id})`)
  console.log('  (Đặt mật khẩu qua /auth/register hoặc seed riêng — Phase 0 chưa wire bcrypt vào seed)')
  console.log('Done.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
