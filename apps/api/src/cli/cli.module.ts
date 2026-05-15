import { Module } from '@nestjs/common'
import { AppModule } from '../app.module'
import { SeedCommand } from './commands/seed.command'

@Module({
  imports: [AppModule],
  providers: [SeedCommand],
})
export class CliModule {}
