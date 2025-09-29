// Export all core Kilo Code tools we've integrated
export { ToolExecutor } from './ToolExecutor'

// Advanced tools from Kilo Code (simplified versions)
export const AVAILABLE_TOOLS = [
  'read_file',
  'write_file', 
  'execute_command',
  'list_files',
  'search_files',
  'apply_diff',
  'ask_followup',
  'attempt_completion',
  'browser_action',
  'codebase_search',
  'generate_image',
  'new_task',
  'switch_mode',
  'use_mcp_tool'
] as const

export type ToolName = typeof AVAILABLE_TOOLS[number]