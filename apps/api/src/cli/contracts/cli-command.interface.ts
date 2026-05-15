export interface CliCommand {
  run(args: string[]): Promise<void>
}
