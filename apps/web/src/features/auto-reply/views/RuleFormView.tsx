'use client'
import { RuleForm } from '../components/RuleForm'

interface RuleFormViewProps {
  ruleId?: string
}

export function RuleFormView({ ruleId }: RuleFormViewProps) {
  return <RuleForm ruleId={ruleId} />
}
